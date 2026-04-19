from __future__ import annotations

try:
    from ..config import Argument, ModeratorScore
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore


def build_consensus(arguments: list[Argument], scores: list[ModeratorScore], termination_reason: str) -> dict:
    weights = {s.agent_id: s.weighted_score for s in scores}
    top = max(arguments, key=lambda a: weights.get(a.agent_id, 0)) if arguments else None
    dissent = [a for a in arguments if a.confidence < 0.8]
    return {
        "answer": top.argument if top else "",
        "confidence": top.confidence if top else 0.0,
        "termination_reason": termination_reason,
        "reasoning_trace": [a.argument for a in arguments],
        "dissent_log": [{"agent": a.agent_id, "objection": a.argument} for a in dissent],
    }
