"""
Kafka → Loki bridge for ArgueNet.

Reads every message from all 3 debate topics and pushes them to Loki
so they appear as searchable log lines in Grafana.

Each log line is labelled with:
  topic       — which Kafka topic the message came from
  agent       — who sent it (advocate, skeptic, moderator, etc.)
  message_type — argument / counterargument / evaluation / control
  debate_id   — unique ID for the debate session

Usage:
    python monitoring/kafka_loki_bridge.py
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone

import requests
from confluent_kafka import Consumer, KafkaError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

LOKI_URL        = os.getenv("LOKI_URL", "http://localhost:3100")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPICS          = [
    "arguenet.debate.arguments",
    "arguenet.debate.control",
    "arguenet.debate.evaluations",
    "arguenet.debate.dlq",
]


def _now_ns() -> str:
    """Return current time as nanosecond Unix timestamp string (Loki format)."""
    return str(int(time.time() * 1e9))


def _push_to_loki(labels: dict[str, str], message: str) -> bool:
    """Push a single log line to Loki via the push API."""
    payload = {
        "streams": [{
            "stream": labels,
            "values": [[_now_ns(), message]],
        }]
    }
    try:
        r = requests.post(
            f"{LOKI_URL}/loki/api/v1/push",
            json=payload,
            timeout=5,
        )
        return r.status_code == 204
    except Exception as exc:
        logger.warning("Loki push failed: %s", exc)
        return False


def _format_log_line(topic: str, envelope: dict) -> str:
    """Format a Kafka envelope as a human-readable log line."""
    msg_type  = envelope.get("message_type", "unknown")
    sender    = envelope.get("sender_id", "unknown")
    round_num = envelope.get("round_number", "?")
    payload   = envelope.get("payload", {})

    if msg_type in ("argument", "counterargument"):
        content = payload.get("argument", payload.get("claim", ""))[:200]
        confidence = payload.get("confidence", "")
        return (f"[{msg_type.upper()}] round={round_num} agent={sender} "
                f"confidence={confidence} | {content}")

    elif msg_type == "evaluation":
        agent_id = payload.get("agent_id", sender)
        score    = payload.get("weighted_score", payload.get("score", ""))
        feedback = payload.get("you_must_respond_to", payload.get("feedback", ""))
        if isinstance(feedback, list):
            feedback = " | ".join(feedback)
        return (f"[EVALUATION] round={round_num} scored={agent_id} "
                f"score={score} | {str(feedback)[:150]}")

    elif msg_type == "control":
        phase  = payload.get("phase", "")
        reason = payload.get("termination_reason", "")
        return (f"[CONTROL] round={round_num} phase={phase} "
                + (f"reason={reason}" if reason else ""))

    elif topic.endswith("dlq"):
        reason       = payload.get("reason", "unknown")
        source_topic = payload.get("source_topic", "unknown")
        raw          = payload.get("raw", "")[:150]
        failed_at    = payload.get("failed_at", "")
        return (f"[DLQ] source={source_topic} reason={reason} "
                f"failed_at={failed_at} | raw={raw}")

    else:
        return f"[{msg_type.upper()}] round={round_num} sender={sender} | {str(payload)[:200]}"


def run_bridge():
    group_id = f"loki-bridge-{uuid.uuid4()}"
    consumer = Consumer({
        "bootstrap.servers": KAFKA_BOOTSTRAP,
        "group.id": group_id,
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
        "group.protocol": "classic",
    })
    consumer.subscribe(TOPICS)

    logger.info("ArgueNet Kafka→Loki bridge started")
    logger.info("Subscribed to: %s", TOPICS)
    logger.info("Pushing to Loki at %s", LOKI_URL)
    logger.info("Open Grafana → Explore → Loki and query: {app=\"arguenet\"}")

    pushed = 0
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.warning("Kafka error: %s", msg.error())
                continue

            try:
                raw = msg.value().decode("utf-8")
                envelope = json.loads(raw)

                topic     = msg.topic()
                sender    = envelope.get("sender_id", "unknown")
                msg_type  = envelope.get("message_type", "unknown")
                debate_id = envelope.get("debate_id", "unknown")
                round_num = str(envelope.get("round_number", "0"))

                labels = {
                    "app":          "arguenet",
                    "topic":        topic.replace("arguenet.debate.", ""),
                    "agent":        sender,
                    "message_type": msg_type,
                    "debate_id":    debate_id[:8],
                    "round":        round_num,
                }

                log_line = _format_log_line(topic, envelope)
                ok = _push_to_loki(labels, log_line)

                if ok:
                    pushed += 1
                    logger.info("[%d] pushed → topic=%-12s agent=%-18s %s",
                                pushed, labels["topic"], sender, log_line[:80])

            except Exception as exc:
                logger.warning("Could not process message: %s", exc)

    except KeyboardInterrupt:
        logger.info("Bridge stopped — %d messages pushed to Loki", pushed)
    finally:
        consumer.close()


if __name__ == "__main__":
    run_bridge()
