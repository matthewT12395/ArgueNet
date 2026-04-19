from __future__ import annotations

from pydantic import BaseModel


class Argument(BaseModel):
    agent_id: str
    round: int
    update_type: str
    update_reasoning: str
    targets: list[str]
    argument: str
    claims: list[str]
    confidence: float
    position_delta: float
    sources: list[str]


class ModeratorScore(BaseModel):
    agent_id: str
    round: int
    relevance: float
    evidence_quality: float
    novelty: float
    rebuttal_force: float
    weighted_score: float
    weakest_dimension: str
    you_must_respond_to: list[str]


AGENT_TEMPS = {
    "skeptic": 0.7,
    "advocate": 0.6,
    "devils_advocate": 1.0,
    "empiricist": 0.4,
    "moderator": 0.2,
}

AGENT_SOURCE_TYPES = {
    "skeptic": ["reddit", "news"],
    "advocate": ["news", "wiki"],
    "devils_advocate": ["reddit", "news"],
    "empiricist": ["news", "wiki", "scraper"],
    "moderator": [],
}

MAX_ROUNDS = 6
CONVERGENCE_THRESHOLD = 0.05
SIMILARITY_THRESHOLD = 0.85
QUORUM = 3
