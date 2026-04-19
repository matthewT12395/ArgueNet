from __future__ import annotations

import json
import logging

from confluent_kafka import Producer, KafkaException

from .schema import MessageEnvelope

logger = logging.getLogger(__name__)


class ArgueNetProducer:
    """
    Thin wrapper around confluent_kafka.Producer.

    Messages are keyed by debate_id so all messages for one debate land on
    the same partition and arrive in order within that debate.
    """

    def __init__(self, bootstrap_servers: str = "localhost:9092") -> None:
        self._producer = Producer({"bootstrap.servers": bootstrap_servers})

    def send(self, topic: str, message: MessageEnvelope) -> None:
        """Publish message and flush until the broker acknowledges."""
        try:
            self._producer.produce(
                topic,
                key=message.debate_id.encode("utf-8"),
                value=json.dumps(message.model_dump()).encode("utf-8"),
            )
            self._producer.flush()
            logger.debug(
                "sent %s from %s → %s (debate=%s round=%d)",
                message.message_type,
                message.sender_id,
                topic,
                message.debate_id,
                message.round_number,
            )
        except KafkaException as exc:
            logger.error("Kafka send failed on topic %s: %s", topic, exc)
            raise

    def close(self) -> None:
        self._producer.flush()

    def __enter__(self) -> ArgueNetProducer:
        return self

    def __exit__(self, *_) -> None:
        self.close()
