"""
ArgueNet Kafka load simulator.
Publishes fake debate messages directly to Kafka — no LLM calls, no tokens.

Usage:
    python monitoring/simulate_load.py --debates 5 --rounds 3 --delay 0.1
"""
import argparse
import asyncio
import sys
import uuid
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from arguenet.messaging.producer import ArgueNetProducer
from arguenet.messaging.schema import ControlPayload, MessageEnvelope
from arguenet.messaging.topics import ARGUMENTS_TOPIC, CONTROL_TOPIC, EVALUATIONS_TOPIC

DEBATE_AGENTS = ["advocate", "skeptic", "devils_advocate", "empiricist"]

FAKE_ARGUMENTS = [
    "Remote work increases productivity by eliminating commute time.",
    "In-person collaboration fosters creativity and team cohesion.",
    "Data shows 30% productivity gains in distributed teams.",
    "Spontaneous hallway conversations drive innovation.",
    "Async communication allows deep focus work.",
]

FAKE_SCORES = [0.72, 0.65, 0.81, 0.58]


def _make_envelope(debate_id, round_num, msg_type, sender, topic_hint, payload):
    return MessageEnvelope(
        debate_id=debate_id,
        round_number=round_num,
        message_type=msg_type,
        sender_id=sender,
        payload=payload,
    )


def simulate_debate(producer: ArgueNetProducer, debate_id: str, num_rounds: int, delay: float):
    question = "Should remote work be default for software teams?"

    for round_num in range(1, num_rounds + 1):
        # ── control: argue ────────────────────────────────────────────────────
        ctrl = _make_envelope(debate_id, round_num, "control", "coordinator", CONTROL_TOPIC,
            ControlPayload(phase="argue", question=question).model_dump())
        producer.send(CONTROL_TOPIC, ctrl)
        time.sleep(delay)

        # ── arguments from all debate agents ──────────────────────────────────
        for i, agent in enumerate(DEBATE_AGENTS):
            arg_env = _make_envelope(debate_id, round_num, "argument", agent, ARGUMENTS_TOPIC, {
                "agent_id": agent,
                "round": round_num,
                "argument": FAKE_ARGUMENTS[i % len(FAKE_ARGUMENTS)],
                "claims": [f"Claim from {agent} in round {round_num}"],
                "confidence": 0.7,
                "sources": ["https://example.com"],
            })
            producer.send(ARGUMENTS_TOPIC, arg_env)
            time.sleep(delay)

        # ── control: score ────────────────────────────────────────────────────
        ctrl_score = _make_envelope(debate_id, round_num, "control", "coordinator", CONTROL_TOPIC,
            ControlPayload(phase="score", question=question).model_dump())
        producer.send(CONTROL_TOPIC, ctrl_score)
        time.sleep(delay)

        # ── evaluations from moderator ────────────────────────────────────────
        for i, agent in enumerate(DEBATE_AGENTS):
            eval_env = _make_envelope(debate_id, round_num, "evaluation", "moderator", EVALUATIONS_TOPIC, {
                "agent_id": agent,
                "round": round_num,
                "weighted_score": FAKE_SCORES[i % len(FAKE_SCORES)],
                "weakest_dimension": "novelty",
            })
            producer.send(EVALUATIONS_TOPIC, eval_env)
            time.sleep(delay)

        # ── control: rebut ────────────────────────────────────────────────────
        ctrl_rebut = _make_envelope(debate_id, round_num, "control", "coordinator", CONTROL_TOPIC,
            ControlPayload(phase="rebut", question=question).model_dump())
        producer.send(CONTROL_TOPIC, ctrl_rebut)
        time.sleep(delay)

        # ── counterarguments ──────────────────────────────────────────────────
        for i, agent in enumerate(DEBATE_AGENTS):
            rebut_env = _make_envelope(debate_id, round_num, "counterargument", agent, ARGUMENTS_TOPIC, {
                "agent_id": agent,
                "round": round_num,
                "argument": f"Rebuttal from {agent}: " + FAKE_ARGUMENTS[(i + 1) % len(FAKE_ARGUMENTS)],
                "claims": [f"Counter-claim from {agent}"],
                "confidence": 0.75,
                "sources": [],
            })
            producer.send(ARGUMENTS_TOPIC, rebut_env)
            time.sleep(delay)

        # ── scorer evaluations ────────────────────────────────────────────────
        for i, agent in enumerate(DEBATE_AGENTS):
            scorer_env = _make_envelope(debate_id, round_num, "evaluation", "scorer", EVALUATIONS_TOPIC, {
                "agent_id": agent,
                "score": round(FAKE_SCORES[i % len(FAKE_SCORES)] * 100, 1),
                "feedback": f"Good argument from {agent}. Improve evidence quality.",
            })
            producer.send(EVALUATIONS_TOPIC, scorer_env)
            time.sleep(delay)

        # ── terminate ─────────────────────────────────────────────────────────
        if round_num == num_rounds:
            ctrl_term = _make_envelope(debate_id, round_num, "control", "coordinator", CONTROL_TOPIC,
                ControlPayload(phase="terminate", question=question,
                               termination_reason="round_cap").model_dump())
            producer.send(CONTROL_TOPIC, ctrl_term)

    print(f"  debate {debate_id[:8]}  {num_rounds} round(s) → "
          f"{num_rounds * (3 + len(DEBATE_AGENTS) * 4)} messages published")


def main():
    parser = argparse.ArgumentParser(description="ArgueNet Kafka load simulator")
    parser.add_argument("--debates", type=int, default=3, help="Number of concurrent debates to simulate")
    parser.add_argument("--rounds",  type=int, default=2, help="Rounds per debate")
    parser.add_argument("--delay",   type=float, default=0.05, help="Seconds between messages (lower = faster)")
    args = parser.parse_args()

    total_msgs = args.debates * args.rounds * (3 + len(DEBATE_AGENTS) * 4)
    print(f"\nArgueNet Load Simulator")
    print(f"  Debates : {args.debates}")
    print(f"  Rounds  : {args.rounds}")
    print(f"  Delay   : {args.delay}s between messages")
    print(f"  Total   : ~{total_msgs} messages across 3 topics")
    print(f"\nWatch Grafana at http://localhost:3000 while this runs...\n")

    with ArgueNetProducer("localhost:9092") as producer:
        start = time.monotonic()
        for i in range(args.debates):
            debate_id = str(uuid.uuid4())
            simulate_debate(producer, debate_id, args.rounds, args.delay)

        elapsed = time.monotonic() - start
        print(f"\nDone — {total_msgs} messages in {elapsed:.1f}s "
              f"({total_msgs/elapsed:.0f} msg/s)")


if __name__ == "__main__":
    main()
