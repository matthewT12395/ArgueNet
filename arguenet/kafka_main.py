"""
Kafka-backed debate runner.

Architecture
────────────
Three Kafka topics carry all inter-agent traffic:

  arguenet.debate.control      coordinator → agents
  arguenet.debate.arguments    debate agents → coordinator + moderator
  arguenet.debate.evaluations  moderator → coordinator + debate agents

Round lifecycle (one iteration of the outer loop in run()):

  1. coordinator publishes control(phase="argue")
     → debate agents invoke LLMs concurrently
     → each publishes an "argument" envelope to arguments topic
     → coordinator collects all 4 arguments

  2. coordinator publishes control(phase="score")
     → moderator invokes LLM
     → publishes one "evaluation" envelope per agent to evaluations topic
     → coordinator collects all 4 scores

  3. coordinator publishes control(phase="rebut")
     → debate agents invoke LLMs with scores in context
     → each publishes a "counterargument" envelope to arguments topic
     → coordinator collects all 4 rebuttals, scores again

  4. termination check — loop or stop

Within a single process the LLM coroutines are invoked directly (asyncio).
Kafka carries the payloads so a future split into separate agent services
only requires replacing the direct coroutine calls with consumer loops.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid

from dotenv import load_dotenv

load_dotenv()

try:
    from .agents.base import build_agents
    from .config import Argument, MAX_ROUNDS, ModeratorScore
    from .debate.consensus import build_consensus
    from .debate.round import _invoke, _prompt, score_round
    from .debate.termination import should_terminate
    from .messaging.consumer import ArgueNetConsumer
    from .messaging.producer import ArgueNetProducer
    from .messaging.router import agents_for_phase, message_type_for_phase
    from .messaging.schema import ControlPayload, MessageEnvelope
    from .messaging.topics import ARGUMENTS_TOPIC, CONTROL_TOPIC, EVALUATIONS_TOPIC
    from .tools.registry import RoundSourceRegistry, set_registry
except ImportError:
    from arguenet.agents.base import build_agents
    from arguenet.config import Argument, MAX_ROUNDS, ModeratorScore
    from arguenet.debate.consensus import build_consensus
    from arguenet.debate.round import _invoke, _prompt, score_round
    from arguenet.debate.termination import should_terminate
    from arguenet.messaging.consumer import ArgueNetConsumer
    from arguenet.messaging.producer import ArgueNetProducer
    from arguenet.messaging.router import agents_for_phase, message_type_for_phase
    from arguenet.messaging.schema import ControlPayload, MessageEnvelope
    from arguenet.messaging.topics import ARGUMENTS_TOPIC, CONTROL_TOPIC, EVALUATIONS_TOPIC
    from arguenet.tools.registry import RoundSourceRegistry, set_registry

logger = logging.getLogger(__name__)

_COLLECT_TIMEOUT_S = 180   # max seconds to wait for all agent responses per phase
_KAFKA_POLL_MS = 300


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_envelope(
    *,
    debate_id: str,
    round_number: int,
    message_type: str,
    sender_id: str,
    payload: dict,
    target_ids: list[str] | None = None,
) -> MessageEnvelope:
    return MessageEnvelope(
        debate_id=debate_id,
        round_number=round_number,
        message_type=message_type,
        sender_id=sender_id,
        target_ids=target_ids or [],
        payload=payload,
    )


async def _collect_from_kafka(
    consumer: ArgueNetConsumer,
    debate_id: str,
    round_number: int,
    expected_senders: list[str],
    loop: asyncio.AbstractEventLoop,
) -> list[MessageEnvelope]:
    """
    Poll Kafka until every expected sender has delivered exactly one message
    for this (debate_id, round_number), or until the timeout expires.
    """
    collected: dict[str, MessageEnvelope] = {}
    deadline = time.monotonic() + _COLLECT_TIMEOUT_S
    remaining = set(expected_senders)

    while remaining and time.monotonic() < deadline:
        msgs = await loop.run_in_executor(
            None,
            lambda: consumer.poll(timeout_ms=_KAFKA_POLL_MS, debate_id=debate_id),
        )
        for msg in msgs:
            if msg.round_number == round_number and msg.sender_id in remaining:
                collected[msg.sender_id] = msg
                remaining.discard(msg.sender_id)
                logger.info(
                    "debate=%s round=%d  received %s from %s  (still waiting: %s)",
                    debate_id, round_number, msg.message_type, msg.sender_id,
                    remaining or "none",
                )

    if remaining:
        logger.warning(
            "debate=%s round=%d  timed out waiting for: %s",
            debate_id, round_number, remaining,
        )

    return list(collected.values())


# ── per-agent invocation + publish ────────────────────────────────────────────

async def _run_debate_agent(
    *,
    agent_id: str,
    agent,
    phase: str,
    prompt: str,
    round_num: int,
    debate_id: str,
    producer: ArgueNetProducer,
    loop: asyncio.AbstractEventLoop,
) -> Argument:
    """Invoke one debate agent LLM, publish the result to Kafka, and return it."""
    result: Argument = await _invoke(
        agent,
        prompt,
        Argument,
        retry_msg="Include at least one targets entry.",
        agent_id=agent_id,
        round_num=round_num,
        default_target=f"shared.round{round_num}.claim1",
    )

    msg_type = message_type_for_phase(phase)  # "argument" or "counterargument"
    envelope = _make_envelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type=msg_type,
        sender_id=agent_id,
        payload=result.model_dump(),
    )
    await loop.run_in_executor(
        None, lambda: producer.send(ARGUMENTS_TOPIC, envelope)
    )
    logger.info("debate=%s round=%d  %s published %s", debate_id, round_num, agent_id, msg_type)
    return result


async def _run_moderator_agent(
    *,
    moderator,
    round_num: int,
    question: str,
    arguments: list[Argument],
    history: list[Argument],
    debate_id: str,
    producer: ArgueNetProducer,
    loop: asyncio.AbstractEventLoop,
) -> list[ModeratorScore]:
    """Score the current arguments, publish each score to Kafka, and return them."""
    scores: list[ModeratorScore] = await score_round(
        round_num, question, moderator, arguments, history
    )

    for score in scores:
        envelope = _make_envelope(
            debate_id=debate_id,
            round_number=round_num,
            message_type="evaluation",
            sender_id="moderator",
            target_ids=[score.agent_id],
            payload=score.model_dump(),
        )
        await loop.run_in_executor(
            None, lambda e=envelope: producer.send(EVALUATIONS_TOPIC, e)
        )

    logger.info(
        "debate=%s round=%d  moderator published %d evaluation(s)",
        debate_id, round_num, len(scores),
    )
    return scores


# ── per-phase orchestration ───────────────────────────────────────────────────

async def _run_argue_phase(
    *,
    debate_id: str,
    round_num: int,
    question: str,
    agents: dict,
    history: list[Argument],
    scores: list[ModeratorScore],
    producer: ArgueNetProducer,
    result_consumer: ArgueNetConsumer,
    loop: asyncio.AbstractEventLoop,
) -> list[Argument]:
    """
    Phase 1: coordinate initial arguments from all debate agents.

    Flow:
      coordinator → control(argue) → [agents consume & respond] → arguments topic
    """
    set_registry(RoundSourceRegistry(round_num))
    names = agents_for_phase("argue")

    # Broadcast phase-start signal to control topic
    control_payload = ControlPayload(
        phase="argue",
        question=question,
        prior_arguments=[a.model_dump() for a in history],
        prior_scores=[s.model_dump() for s in scores],
    )
    ctrl_envelope = _make_envelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type="control",
        sender_id="coordinator",
        payload=control_payload.model_dump(),
    )
    await loop.run_in_executor(None, lambda: producer.send(CONTROL_TOPIC, ctrl_envelope))
    logger.info("debate=%s round=%d  coordinator → argue phase", debate_id, round_num)

    # All debate agents produce arguments concurrently
    prompt = _prompt("argue", question, round_num, history, scores)
    results: list[Argument] = await asyncio.gather(*[
        _run_debate_agent(
            agent_id=n,
            agent=agents[n],
            phase="argue",
            prompt=prompt,
            round_num=round_num,
            debate_id=debate_id,
            producer=producer,
            loop=loop,
        )
        for n in names
    ])

    # Coordinator collects from Kafka (confirms delivery; payload already in `results`)
    await _collect_from_kafka(result_consumer, debate_id, round_num, names, loop)

    return results


async def _run_score_phase(
    *,
    debate_id: str,
    round_num: int,
    question: str,
    agents: dict,
    arguments: list[Argument],
    history: list[Argument],
    producer: ArgueNetProducer,
    result_consumer: ArgueNetConsumer,
    loop: asyncio.AbstractEventLoop,
) -> list[ModeratorScore]:
    """
    Phase 2: moderator scores the current arguments.

    Flow:
      coordinator → control(score) → [moderator scores] → evaluations topic
    """
    control_payload = ControlPayload(
        phase="score",
        question=question,
        prior_arguments=[a.model_dump() for a in arguments],
        prior_scores=[],
    )
    ctrl_envelope = _make_envelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type="control",
        sender_id="coordinator",
        payload=control_payload.model_dump(),
    )
    await loop.run_in_executor(None, lambda: producer.send(CONTROL_TOPIC, ctrl_envelope))
    logger.info("debate=%s round=%d  coordinator → score phase", debate_id, round_num)

    scores = await _run_moderator_agent(
        moderator=agents["moderator"],
        round_num=round_num,
        question=question,
        arguments=arguments,
        history=history,
        debate_id=debate_id,
        producer=producer,
        loop=loop,
    )

    await _collect_from_kafka(result_consumer, debate_id, round_num, ["moderator"], loop)

    return scores


async def _run_rebut_phase(
    *,
    debate_id: str,
    round_num: int,
    question: str,
    agents: dict,
    prior_arguments: list[Argument],
    scores: list[ModeratorScore],
    history: list[Argument],
    producer: ArgueNetProducer,
    result_consumer: ArgueNetConsumer,
    loop: asyncio.AbstractEventLoop,
) -> list[Argument]:
    """
    Phase 3: debate agents rebut based on moderator feedback.

    Flow:
      coordinator → control(rebut) → [agents rebut] → arguments topic
    """
    names = agents_for_phase("rebut")

    control_payload = ControlPayload(
        phase="rebut",
        question=question,
        prior_arguments=[a.model_dump() for a in prior_arguments],
        prior_scores=[s.model_dump() for s in scores],
    )
    ctrl_envelope = _make_envelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type="control",
        sender_id="coordinator",
        payload=control_payload.model_dump(),
    )
    await loop.run_in_executor(None, lambda: producer.send(CONTROL_TOPIC, ctrl_envelope))
    logger.info("debate=%s round=%d  coordinator → rebut phase", debate_id, round_num)

    prompt = _prompt("rebut", question, round_num, history, scores, prior_arguments)
    results: list[Argument] = await asyncio.gather(*[
        _run_debate_agent(
            agent_id=n,
            agent=agents[n],
            phase="rebut",
            prompt=prompt,
            round_num=round_num,
            debate_id=debate_id,
            producer=producer,
            loop=loop,
        )
        for n in names
    ])

    await _collect_from_kafka(result_consumer, debate_id, round_num, names, loop)

    return results


# ── top-level runner ──────────────────────────────────────────────────────────

class KafkaDebateRunner:
    """
    Orchestrates a full ArgueNet debate over Kafka.

    Usage:
        runner = KafkaDebateRunner(bootstrap_servers="localhost:9092")
        result = await runner.run("Should remote work be default for software teams?")
    """

    def __init__(self, bootstrap_servers: str = "localhost:9092") -> None:
        self.bootstrap_servers = bootstrap_servers

    async def run(self, question: str) -> dict:
        debate_id = str(uuid.uuid4())
        max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
        agents = build_agents()
        loop = asyncio.get_event_loop()

        # Unique consumer group IDs so coordinator gets all messages independently
        # of any external consumers that may be running.
        coord_group = f"coordinator-{debate_id}"

        with ArgueNetProducer(self.bootstrap_servers) as producer, \
             ArgueNetConsumer(
                 [ARGUMENTS_TOPIC, EVALUATIONS_TOPIC],
                 group_id=coord_group,
                 bootstrap_servers=self.bootstrap_servers,
                 auto_offset_reset="latest",
             ) as result_consumer:

            # Warmup poll: confluent-kafka finalises partition assignment on the
            # first poll, so we must call it before producing any messages.
            await loop.run_in_executor(None, lambda: result_consumer.poll(timeout_ms=5000))

            history: list[list[Argument]] = []
            all_scores: list[ModeratorScore] = []
            reason = "round_cap"

            for round_num in range(1, max_rounds + 1):
                logger.info("━━━ debate=%s  round %d / %d ━━━", debate_id, round_num, max_rounds)

                # Flatten history (list of rounds) into a single list for prompts
                flat_history = [a for round_args in history for a in round_args]

                # ── argue ────────────────────────────────────────────────────
                arguments = await _run_argue_phase(
                    debate_id=debate_id,
                    round_num=round_num,
                    question=question,
                    agents=agents,
                    history=flat_history,
                    scores=all_scores,
                    producer=producer,
                    result_consumer=result_consumer,
                    loop=loop,
                )

                # ── score (intermediate) ──────────────────────────────────────
                mid_scores = await _run_score_phase(
                    debate_id=debate_id,
                    round_num=round_num,
                    question=question,
                    agents=agents,
                    arguments=arguments,
                    history=flat_history,
                    producer=producer,
                    result_consumer=result_consumer,
                    loop=loop,
                )

                # ── rebut ─────────────────────────────────────────────────────
                rebuttals = await _run_rebut_phase(
                    debate_id=debate_id,
                    round_num=round_num,
                    question=question,
                    agents=agents,
                    prior_arguments=arguments,
                    scores=mid_scores,
                    history=flat_history,
                    producer=producer,
                    result_consumer=result_consumer,
                    loop=loop,
                )

                # ── final score ───────────────────────────────────────────────
                final_scores = await _run_score_phase(
                    debate_id=debate_id,
                    round_num=round_num,
                    question=question,
                    agents=agents,
                    arguments=rebuttals,
                    history=flat_history,
                    producer=producer,
                    result_consumer=result_consumer,
                    loop=loop,
                )

                history.append(rebuttals)
                all_scores = final_scores

                done, reason = should_terminate(round_num, history, rebuttals)
                if done:
                    logger.info("debate=%s  terminating after round %d: %s", debate_id, round_num, reason)
                    # Signal terminate to any external consumers
                    term_envelope = _make_envelope(
                        debate_id=debate_id,
                        round_number=round_num,
                        message_type="control",
                        sender_id="coordinator",
                        payload=ControlPayload(
                            phase="terminate",
                            question=question,
                            termination_reason=reason,
                        ).model_dump(),
                    )
                    await loop.run_in_executor(None, lambda: producer.send(CONTROL_TOPIC, term_envelope))
                    break

        return build_consensus(history[-1], all_scores, reason)


# ── CLI entry point ───────────────────────────────────────────────────────────

async def main(question: str, bootstrap_servers: str = "localhost:9092") -> dict:
    runner = KafkaDebateRunner(bootstrap_servers=bootstrap_servers)
    return await runner.run(question)


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    q = " ".join(sys.argv[1:]) or "Should remote work be default for software teams?"
    bs = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    print(json.dumps(asyncio.run(main(q, bs)), indent=2))
