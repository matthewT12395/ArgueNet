from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── agent role sets ───────────────────────────────────────────────────────────
DEBATE_AGENTS: list[str] = ["advocate", "skeptic", "devils_advocate", "empiricist"]
ALL_AGENTS: list[str] = DEBATE_AGENTS + ["moderator"]

# ── message / phase discriminators ───────────────────────────────────────────
MessageType = Literal["argument", "counterargument", "evaluation", "control"]
Phase = Literal["argue", "rebut", "score", "terminate"]


# ── payload schemas ───────────────────────────────────────────────────────────

class ControlPayload(BaseModel):
    """Sent by the coordinator on the control topic to advance the debate."""
    phase: Phase
    question: str
    # serialised Argument dicts from previous rounds
    prior_arguments: list[dict[str, Any]] = Field(default_factory=list)
    # serialised ModeratorScore dicts from the most recent score pass
    prior_scores: list[dict[str, Any]] = Field(default_factory=list)
    # populated only when phase == "terminate"
    termination_reason: str = ""


# ── envelope that wraps every Kafka message ───────────────────────────────────

class MessageEnvelope(BaseModel):
    """
    Every message on any ArgueNet topic is wrapped in this envelope.

    topic           produced by         consumed by
    ─────────────── ─────────────────── ──────────────────────────────
    control         coordinator         debate agents + moderator
    arguments       debate agents       coordinator + moderator
    evaluations     moderator           coordinator + debate agents
    """

    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    debate_id: str
    round_number: int
    message_type: MessageType

    # who sent this
    sender_id: str
    # empty list means broadcast; otherwise only listed agents should act on it
    target_ids: list[str] = Field(default_factory=list)

    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # serialised ControlPayload, Argument, or ModeratorScore
    payload: dict[str, Any]
