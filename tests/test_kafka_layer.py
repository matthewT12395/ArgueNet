"""
Tests for the ArgueNet Kafka messaging layer.
Run with: python -m pytest tests/test_kafka_layer.py -v
"""
import os, sys, json, time, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.kafka]

# ── 1. Kafka broker connectivity ──────────────────────────────────────────────

def test_kafka_broker_reachable():
    from arguenet.messaging.health import check_connection
    assert check_connection("localhost:9092"), "Kafka broker not reachable at localhost:9092"

def test_required_topics_exist():
    from arguenet.messaging.health import health_report
    report = health_report("localhost:9092")
    topics = report.get("topics", {})
    for t in ["arguenet.debate.arguments", "arguenet.debate.control", "arguenet.debate.evaluations"]:
        assert t in topics, f"Topic {t} missing from broker"

# ── 2. Message schema validation ──────────────────────────────────────────────

def test_message_envelope_defaults():
    from arguenet.messaging.schema import MessageEnvelope
    env = MessageEnvelope(
        debate_id="test-debate",
        round_number=1,
        message_type="argument",
        sender_id="advocate",
        payload={"argument": "test"},
    )
    assert env.message_id  # auto-generated UUID
    assert env.timestamp   # auto-generated timestamp
    assert env.target_ids == []

def test_control_payload_serialises():
    from arguenet.messaging.schema import ControlPayload
    cp = ControlPayload(phase="argue", question="Is remote work better?")
    d = cp.model_dump()
    assert d["phase"] == "argue"
    assert d["prior_arguments"] == []
    assert d["termination_reason"] == ""

# ── 3. Producer / Consumer round-trip ─────────────────────────────────────────

def test_producer_consumer_roundtrip():
    from arguenet.messaging.producer import ArgueNetProducer
    from arguenet.messaging.consumer import ArgueNetConsumer
    from arguenet.messaging.schema import MessageEnvelope

    test_topic = "arguenet.debate.arguments"
    debate_id = f"test-{uuid.uuid4()}"
    group_id  = f"test-group-{uuid.uuid4()}"

    with ArgueNetProducer("localhost:9092") as producer, \
         ArgueNetConsumer([test_topic], group_id=group_id,
                          bootstrap_servers="localhost:9092",
                          auto_offset_reset="latest") as consumer:

        # Poll until partition assignment is confirmed (up to 10s)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            consumer.poll(timeout_ms=1000)
            if consumer._consumer.assignment():
                break

        envelope = MessageEnvelope(
            debate_id=debate_id,
            round_number=1,
            message_type="argument",
            sender_id="advocate",
            payload={"argument": "Test argument for round-trip test"},
        )
        producer.send(test_topic, envelope)

        # Poll for up to 10 seconds
        received = None
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            msgs = consumer.poll(timeout_ms=1000, debate_id=debate_id)
            for msg in msgs:
                if msg.debate_id == debate_id:
                    received = msg
                    break
            if received:
                break

    assert received is not None, "Message was not received within 10 seconds"
    assert received.sender_id == "advocate"
    assert received.payload["argument"] == "Test argument for round-trip test"

# ── 4. Dead letter queue ───────────────────────────────────────────────────────

def test_dlq_routes_malformed_message():
    from arguenet.messaging.dlq import DeadLetterQueue, DLQConsumer

    unique_reason = f"test_malformed_{uuid.uuid4().hex[:8]}"
    unique_group  = f"test-dlq-{uuid.uuid4()}"

    # Start consumer first so it's subscribed before the message is produced
    with DLQConsumer(group_id=unique_group, bootstrap_servers="localhost:9092") as dlq_consumer:
        # Wait for partition assignment
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            dlq_consumer._consumer.poll(0.5)
            if dlq_consumer._consumer.assignment():
                break

        with DeadLetterQueue("localhost:9092") as dlq:
            dlq.send(
                raw_value=b"not valid json {{{{",
                reason=unique_reason,
                source_topic="arguenet.debate.arguments",
                debate_id="dlq-test",
            )

        messages = dlq_consumer.drain(timeout_ms=5000)

    assert any(m.get("reason") == unique_reason for m in messages), \
        "Malformed message not found in DLQ"

# ── 5. Router logic ───────────────────────────────────────────────────────────

def test_agents_for_phase():
    from arguenet.messaging.router import agents_for_phase
    assert set(agents_for_phase("argue")) == {"advocate", "skeptic", "devils_advocate", "empiricist"}
    assert agents_for_phase("score") == ["moderator"]
    assert agents_for_phase("rebut") == agents_for_phase("argue")

def test_message_type_for_phase():
    from arguenet.messaging.router import message_type_for_phase
    assert message_type_for_phase("argue") == "argument"
    assert message_type_for_phase("rebut") == "counterargument"
    assert message_type_for_phase("score") == "evaluation"

# ── 6. Config / schema models ─────────────────────────────────────────────────

def test_argument_model():
    from arguenet.config import Argument
    arg = Argument(
        agent_id="advocate",
        round=1,
        update_type="refine",
        update_reasoning="test",
        targets=["claim1"],
        argument="Remote work is productive.",
        claims=["Studies show 30% productivity increase"],
        confidence=0.8,
        position_delta=0.05,
        sources=["https://example.com"],
    )
    assert arg.agent_id == "advocate"
    assert arg.confidence == 0.8

def test_moderator_score_model():
    from arguenet.config import ModeratorScore
    score = ModeratorScore(
        agent_id="skeptic",
        round=1,
        relevance=0.7,
        evidence_quality=0.6,
        novelty=0.5,
        rebuttal_force=0.8,
        weighted_score=0.65,
        weakest_dimension="novelty",
        you_must_respond_to=["Provide stronger evidence"],
    )
    assert score.weighted_score == 0.65

# ── 7. Full 1-round debate (integration) ─────────────────────────────────────

@pytest.mark.integration
@pytest.mark.timeout(300)
def test_full_debate_one_round():
    import asyncio
    from arguenet.kafka_main import main

    result = asyncio.run(main(
        "Should remote work be default for software teams?",
        bootstrap_servers="localhost:9092",
    ))

    assert isinstance(result, dict), "Result should be a dict"
    assert "answer" in result, "Result missing 'answer' key"
    assert "confidence" in result, "Result missing 'confidence' key"
    assert result["answer"], "Answer should not be empty"
    print(f"\nDebate answer: {result['answer'][:200]}")
    print(f"Confidence: {result['confidence']}")
