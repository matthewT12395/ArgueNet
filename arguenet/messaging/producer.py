from __future__ import annotations

import json
import logging
import os

from confluent_kafka import Producer, KafkaException

from .kafka_config import build_kafka_config
from .schema import MessageEnvelope

logger = logging.getLogger(__name__)

def _delivery_report(err, msg) -> None:
    """Callback fired by confluent-kafka after each produce attempt."""
    if err is not None:
        logger.error(
            "Delivery failed for message on %s [partition %d]: %s",
            msg.topic(), msg.partition(), err,
        )
    else:
        logger.debug(
            "Message delivered to %s [partition %d] offset %d",
            msg.topic(), msg.partition(), msg.offset(),
        )


class ArgueNetProducer:
    """
    Thin wrapper around confluent_kafka.Producer.

    Bootstrap servers are read from the KAFKA_BOOTSTRAP_SERVERS environment
    variable (default: localhost:9092) and can be overridden at construction.

    Messages are keyed by debate_id so all messages for one debate land on
    the same partition and arrive in order within that debate.
    """

    def __init__(self, bootstrap_servers: str | None = None) -> None:
        if bootstrap_servers is None:
            bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self._producer = Producer(build_kafka_config(
            bootstrap_servers,
            acks="all",
            retries=3,
            **{"retry.backoff.ms": 200},
        ))

    def send(self, topic: str, message: MessageEnvelope) -> None:
        """Publish message and flush until the broker acknowledges."""
        try:
            self._producer.produce(
                topic,
                key=message.debate_id.encode("utf-8"),
                value=json.dumps(message.model_dump()).encode("utf-8"),
                on_delivery=_delivery_report,
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
