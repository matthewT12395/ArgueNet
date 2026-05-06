from __future__ import annotations

import logging
import os
from typing import Any

from confluent_kafka import Consumer, KafkaException
from confluent_kafka.admin import AdminClient, NewTopic

from .kafka_config import build_kafka_config
from .topics import ALL_TOPICS

logger = logging.getLogger(__name__)

def _default_bootstrap() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


def _admin(bootstrap_servers: str) -> AdminClient:
    return AdminClient(build_kafka_config(bootstrap_servers))


def check_connection(bootstrap_servers: str | None = None) -> bool:
    """
    Return True if the Kafka broker is reachable, False otherwise.
    Uses a short-lived consumer to probe the cluster metadata.
    """
    if bootstrap_servers is None:
        bootstrap_servers = _default_bootstrap()
    try:
        c = Consumer(build_kafka_config(
            bootstrap_servers,
            **{
                "group.id": "__arguenet_health_probe__",
                "group.protocol": "classic",
            },
        ))
        meta = c.list_topics(timeout=5)
        c.close()
        logger.info("Kafka broker reachable at %s (%d topic(s) visible)", bootstrap_servers, len(meta.topics))
        return True
    except KafkaException as exc:
        logger.error("Kafka broker not reachable at %s: %s", bootstrap_servers, exc)
        return False


def ensure_topics(
    bootstrap_servers: str | None = None,
    topics: list[str] | None = None,
    num_partitions: int = 1,
    replication_factor: int = 1,
) -> dict[str, str]:
    """
    Create any missing ArgueNet topics on the broker.

    Returns a dict mapping each topic name to its status:
      "already_exists" | "created" | "error:<message>"
    """
    if bootstrap_servers is None:
        bootstrap_servers = _default_bootstrap()
    topics = topics or ALL_TOPICS
    admin = _admin(bootstrap_servers)

    existing = set(admin.list_topics(timeout=5).topics.keys())
    to_create = [t for t in topics if t not in existing]

    results: dict[str, str] = {t: "already_exists" for t in topics if t in existing}

    if not to_create:
        logger.info("All %d ArgueNet topics already exist.", len(topics))
        return results

    new_topics = [
        NewTopic(t, num_partitions=num_partitions, replication_factor=replication_factor)
        for t in to_create
    ]
    fs = admin.create_topics(new_topics)

    for topic, future in fs.items():
        try:
            future.result()
            results[topic] = "created"
            logger.info("Created topic: %s", topic)
        except KafkaException as exc:
            results[topic] = f"error:{exc}"
            logger.error("Failed to create topic %s: %s", topic, exc)

    return results


def health_report(bootstrap_servers: str | None = None) -> dict[str, Any]:
    """
    Return a full health snapshot:
      - broker_reachable: bool
      - topics: dict[topic_name, status]
      - bootstrap_servers: str
    """
    if bootstrap_servers is None:
        bootstrap_servers = _default_bootstrap()
    reachable = check_connection(bootstrap_servers)
    topic_status: dict[str, str] = {}

    if reachable:
        try:
            admin = _admin(bootstrap_servers)
            existing = set(admin.list_topics(timeout=5).topics.keys())
            for t in ALL_TOPICS:
                topic_status[t] = "exists" if t in existing else "missing"
        except KafkaException as exc:
            logger.error("Could not list topics: %s", exc)
            topic_status = {t: "unknown" for t in ALL_TOPICS}
    else:
        topic_status = {t: "unknown" for t in ALL_TOPICS}

    return {
        "broker_reachable": reachable,
        "bootstrap_servers": bootstrap_servers,
        "topics": topic_status,
    }
