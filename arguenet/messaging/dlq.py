from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from confluent_kafka import Consumer, Producer, KafkaException

from .kafka_config import build_kafka_config

logger = logging.getLogger(__name__)

DLQ_TOPIC = "arguenet.debate.dlq"


class DeadLetterQueue:
    """
    Routes failed or malformed messages to a dedicated DLQ topic
    (arguenet.debate.dlq) instead of silently dropping them.

    Each DLQ record wraps the original raw bytes alongside metadata
    that explains why the message was rejected, making it easy to
    inspect failures and replay them if needed.
    """

    def __init__(self, bootstrap_servers: str | None = None) -> None:
        if bootstrap_servers is None:
            bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self._producer = Producer(build_kafka_config(bootstrap_servers))

    def send(
        self,
        raw_value: bytes,
        reason: str,
        source_topic: str,
        debate_id: str | None = None,
    ) -> None:
        """
        Publish a failed message to the DLQ with failure metadata attached.

        Args:
            raw_value:    The original raw bytes that failed to parse/process.
            reason:       Human-readable description of the failure.
            source_topic: The topic the message originally came from.
            debate_id:    Optional debate context for filtering DLQ records.
        """
        record: dict[str, Any] = {
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "source_topic": source_topic,
            "debate_id": debate_id,
            "reason": reason,
            "raw": raw_value.decode("utf-8", errors="replace"),
        }
        try:
            self._producer.produce(
                DLQ_TOPIC,
                key=(debate_id or "unknown").encode("utf-8"),
                value=json.dumps(record).encode("utf-8"),
            )
            self._producer.flush()
            logger.warning(
                "DLQ: routed failed message from %s → %s  reason=%r",
                source_topic, DLQ_TOPIC, reason,
            )
        except KafkaException as exc:
            logger.error("DLQ publish failed: %s", exc)

    def close(self) -> None:
        self._producer.flush()

    def __enter__(self) -> DeadLetterQueue:
        return self

    def __exit__(self, *_) -> None:
        self.close()


class DLQConsumer:
    """
    Read and inspect failed messages from the DLQ topic.
    Useful for debugging and manual replay.
    """

    def __init__(
        self,
        group_id: str = "arguenet-dlq-inspector",
        bootstrap_servers: str | None = None,
    ) -> None:
        if bootstrap_servers is None:
            bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self._consumer = Consumer(build_kafka_config(
            bootstrap_servers,
            **{
                "group.id": group_id,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
                "group.protocol": "classic",
            },
        ))
        self._consumer.subscribe([DLQ_TOPIC])

    def drain(self, timeout_ms: int = 5000) -> list[dict[str, Any]]:
        """Return all available DLQ records."""
        import time
        records: list[dict[str, Any]] = []
        deadline = time.monotonic() + timeout_ms / 1000.0

        while time.monotonic() < deadline:
            remaining = max(0.05, deadline - time.monotonic())
            msg = self._consumer.poll(timeout=remaining)
            if msg is None:
                break
            if msg.error():
                continue
            try:
                records.append(json.loads(msg.value().decode("utf-8")))
            except Exception as exc:
                logger.warning("Could not parse DLQ record: %s", exc)

        return records

    def close(self) -> None:
        self._consumer.close()

    def __enter__(self) -> DLQConsumer:
        return self

    def __exit__(self, *_) -> None:
        self.close()
