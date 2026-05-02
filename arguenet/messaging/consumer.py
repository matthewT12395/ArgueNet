from __future__ import annotations

import json
import logging
import os

from confluent_kafka import Consumer, KafkaError, KafkaException

from .dlq import DeadLetterQueue
from .schema import MessageEnvelope

logger = logging.getLogger(__name__)

_DEFAULT_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


class ArgueNetConsumer:
    """
    Thin wrapper around confluent_kafka.Consumer.

    Each role uses a unique group_id so that:
    - The coordinator gets its own copy of every message.
    - Each agent gets its own copy of every control message.

    poll() optionally filters by debate_id so consumers in a shared
    Kafka cluster only process messages that belong to their debate.
    """

    def __init__(
        self,
        topics: list[str],
        group_id: str,
        bootstrap_servers: str = _DEFAULT_BOOTSTRAP,
        auto_offset_reset: str = "latest",
        enable_dlq: bool = True,
    ) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._topics = topics
        self._consumer = Consumer({
            "bootstrap.servers": bootstrap_servers,
            "group.id": group_id,
            "auto.offset.reset": auto_offset_reset,
            "enable.auto.commit": True,
            # Kafka 4.x defaults to the new KIP-848 consumer group protocol;
            # confluent-kafka 2.x only supports the classic protocol.
            "group.protocol": "classic",
        })
        self._consumer.subscribe(topics)
        self._dlq = DeadLetterQueue(bootstrap_servers) if enable_dlq else None

    def poll(
        self,
        timeout_ms: int = 500,
        debate_id: str | None = None,
    ) -> list[MessageEnvelope]:
        """
        Return all available messages, optionally scoped to one debate.
        Malformed messages are logged and skipped.
        """
        messages: list[MessageEnvelope] = []
        timeout_s = timeout_ms / 1000.0

        # confluent-kafka polls one message at a time; drain until timeout
        import time
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            remaining = max(0.05, deadline - time.monotonic())
            msg = self._consumer.poll(timeout=remaining)
            if msg is None:
                break
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.warning("Consumer error: %s", msg.error())
                continue
            try:
                data = json.loads(msg.value().decode("utf-8"))
                envelope = MessageEnvelope(**data)
                if debate_id is None or envelope.debate_id == debate_id:
                    messages.append(envelope)
            except Exception as exc:
                logger.warning("Malformed Kafka record: %s — routing to DLQ", exc)
                if self._dlq is not None:
                    self._dlq.send(
                        raw_value=msg.value(),
                        reason=str(exc),
                        source_topic=msg.topic(),
                        debate_id=debate_id,
                    )

        return messages

    def close(self) -> None:
        self._consumer.close()
        if self._dlq is not None:
            self._dlq.close()

    def __enter__(self) -> ArgueNetConsumer:
        return self

    def __exit__(self, *_) -> None:
        self.close()
