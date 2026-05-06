from __future__ import annotations

# ── Kafka topic names ─────────────────────────────────────────────────────────

CONTROL_TOPIC: str = "arguenet.debate.control"
ARGUMENTS_TOPIC: str = "arguenet.debate.arguments"
EVALUATIONS_TOPIC: str = "arguenet.debate.evaluations"
DLQ_TOPIC: str = "arguenet.debate.dlq"

ALL_TOPICS: list[str] = [CONTROL_TOPIC, ARGUMENTS_TOPIC, EVALUATIONS_TOPIC, DLQ_TOPIC]

# ── Per-role routing table ────────────────────────────────────────────────────
#
# Each entry describes which topic the role publishes to and which topics it
# must consume from to participate in the debate.
#
#   coordinator   – publishes phase control signals; reads results
#   debate agents – publish arguments/counterarguments; read control + scores
#   moderator     – publishes evaluation scores; reads control + arguments

AGENT_ROUTING: dict[str, dict[str, object]] = {
    "advocate": {
        "publishes": ARGUMENTS_TOPIC,
        "consumes": [CONTROL_TOPIC, EVALUATIONS_TOPIC],
    },
    "skeptic": {
        "publishes": ARGUMENTS_TOPIC,
        "consumes": [CONTROL_TOPIC, EVALUATIONS_TOPIC],
    },
    "devils_advocate": {
        "publishes": ARGUMENTS_TOPIC,
        "consumes": [CONTROL_TOPIC, EVALUATIONS_TOPIC],
    },
    "empiricist": {
        "publishes": ARGUMENTS_TOPIC,
        "consumes": [CONTROL_TOPIC, EVALUATIONS_TOPIC],
    },
    "moderator": {
        "publishes": EVALUATIONS_TOPIC,
        "consumes": [CONTROL_TOPIC, ARGUMENTS_TOPIC],
    },
    "coordinator": {
        "publishes": CONTROL_TOPIC,
        "consumes": [ARGUMENTS_TOPIC, EVALUATIONS_TOPIC],
    },
}
