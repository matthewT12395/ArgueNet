from __future__ import annotations

from difflib import SequenceMatcher

try:
    from ..config import Argument, CONVERGENCE_THRESHOLD, MAX_ROUNDS, QUORUM, SIMILARITY_THRESHOLD
except ImportError:  # pragma: no cover
    from config import Argument, CONVERGENCE_THRESHOLD, MAX_ROUNDS, QUORUM, SIMILARITY_THRESHOLD


def semantic_similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()


def is_converged(history: list[list[Argument]]) -> bool:
    # Require at least 2 completed rounds before convergence can be declared,
    # so a single noisy/fallback round can't end the debate immediately.
    return len(history) >= 2 and sum(a.position_delta for a in history[-1]) / max(1, len(history[-1])) < CONVERGENCE_THRESHOLD


def is_stalemate(history: list[list[Argument]]) -> bool:
    return len(history) >= 2 and semantic_similarity(" ".join(a.argument for a in history[-1]), " ".join(a.argument for a in history[-2])) > SIMILARITY_THRESHOLD


def quorum_reached(arguments: list[Argument]) -> bool:
    return sum(1 for a in arguments if a.confidence > 0.8) >= QUORUM


def round_cap_hit(round_num: int) -> bool:
    return round_num >= MAX_ROUNDS


def should_terminate(round_num: int, history: list[list[Argument]], arguments: list[Argument]) -> tuple[bool, str]:
    if is_converged(history): return True, "convergence"
    if is_stalemate(history): return True, "stalemate"
    if quorum_reached(arguments): return True, "quorum"
    if round_cap_hit(round_num): return True, "round_cap"
    return False, ""
