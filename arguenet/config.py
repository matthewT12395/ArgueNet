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


class RoundScore(BaseModel):
    round: int
    winner: str
    winner_score: float
    all_scores: dict[str, float]  # agent_id -> score (0-100)
    all_arguments: dict[str, str]  # agent_id -> their argument
    fact_checks: dict[str, str] = {}  # agent_id -> fact-check summary
    summary: str
    key_insights: list[str]
    feedback_for_agents: dict[str, str]  # agent_id -> personalized feedback


AGENT_TEMPS = {
    "skeptic": 0.7,
    "advocate": 0.6,
    "devils_advocate": 1.0,
    "empiricist": 0.4,
    "moderator": 0.2,
    "scorer": 0.3,
    "personal_agent": 0.65,
}

AGENT_SOURCE_TYPES = {
    "skeptic": ["reddit", "news"],
    "advocate": ["news", "wiki"],
    "devils_advocate": ["reddit", "news"],
    "empiricist": ["news", "wiki", "scraper"],
    "moderator": [],
    "scorer": [],
    "personal_agent": ["news", "wiki", "reddit"],
}

MAX_ROUNDS = 6
CONVERGENCE_THRESHOLD = 0.05
SIMILARITY_THRESHOLD = 0.85
QUORUM = 3
