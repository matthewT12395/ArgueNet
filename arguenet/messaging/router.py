from __future__ import annotations

from .schema import DEBATE_AGENTS, MessageType, Phase


def message_type_for_phase(phase: Phase) -> MessageType:
    """
    Map a debate phase to the Kafka message type that agents emit during it.

    argue  → "argument"       (initial position, round 1 or after a new question)
    rebut  → "counterargument" (direct response to another agent's claim)
    score  → "evaluation"      (moderator scoring pass)
    terminate → "control"      (coordinator signals end-of-debate)
    """
    return {
        "argue": "argument",
        "rebut": "counterargument",
        "score": "evaluation",
        "terminate": "control",
    }[phase]


def agents_for_phase(phase: Phase, debate_agents: list[str] | None = None) -> list[str]:
    """
    Return the ordered list of agent IDs that must produce output in a phase.

    argue / rebut  → all four debate agents, in a fixed canonical order
    score          → moderator only
    terminate      → no agents respond
    """
    if phase in ("argue", "rebut"):
        if debate_agents is not None:
            return list(debate_agents)
        return list(DEBATE_AGENTS)      # advocate, skeptic, devils_advocate, empiricist
    if phase == "score":
        return ["moderator"]
    return []


def rebuttal_targets(agent_id: str, scores: list[dict]) -> list[str]:
    """
    Extract the you_must_respond_to list for agent_id from a set of
    ModeratorScore dicts.  Returns an empty list when scores are absent.
    """
    for score in scores:
        if score.get("agent_id") == agent_id:
            return score.get("you_must_respond_to", [])
    return []


def debate_agent_order() -> list[str]:
    """Canonical order in which debate agents argue each round."""
    return list(DEBATE_AGENTS)
