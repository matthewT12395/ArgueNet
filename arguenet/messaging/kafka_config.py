from __future__ import annotations

import os


def build_kafka_config(bootstrap_servers: str, **extra) -> dict:
    """
    Build a confluent-kafka config dict.

    When KAFKA_SASL_KEY and KAFKA_SASL_SECRET are set (Confluent Cloud),
    SASL_SSL auth is added automatically. Falls back to plain plaintext
    for local development when those vars are absent.
    """
    cfg: dict = {"bootstrap.servers": bootstrap_servers, **extra}

    sasl_key = os.getenv("KAFKA_SASL_KEY", "")
    sasl_secret = os.getenv("KAFKA_SASL_SECRET", "")
    if sasl_key and sasl_secret:
        cfg.update({
            "security.protocol": "SASL_SSL",
            "sasl.mechanism": "PLAIN",
            "sasl.username": sasl_key,
            "sasl.password": sasl_secret,
        })

    return cfg
