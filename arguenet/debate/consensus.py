from __future__ import annotations

try:
    from ..config import Argument, ModeratorScore
    from .voting import VotingAlgorithm, VotingMode
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore
    from voting import VotingAlgorithm, VotingMode


def build_consensus(
    arguments: list[Argument],
    scores: list[ModeratorScore],
    termination_reason: str,
    voting_mode: str = "auto",
) -> dict:
    """
    Build consensus using the voting algorithm.
    
    Args:
        arguments: List of agent arguments
        scores: List of moderator scores
        termination_reason: Why the debate terminated
        voting_mode: Voting strategy ("auto", "unanimity", "supermajority", "weighted_consensus", etc.)
    
    Returns:
        Consensus result with voting details and transparency
    """
    # Initialize voting algorithm
    voter = VotingAlgorithm()
    
    # Parse voting mode if specified
    force_mode = None
    if voting_mode != "auto":
        try:
            force_mode = VotingMode(voting_mode)
        except ValueError:
            force_mode = None
    
    # Execute voting
    result = voter.execute(arguments, scores, force_mode=force_mode)
    
    # Collect dissent
    dissent = [a for a in arguments if a.confidence < 0.6]
    
    return {
        "answer": result.consensus_answer,
        "confidence": result.consensus_confidence,
        "termination_reason": termination_reason,
        "reasoning_trace": [a.argument for a in arguments],
        "dissent_log": [{"agent": a.agent_id, "objection": a.argument, "confidence": a.confidence} for a in dissent],
        # New voting insights for transparency
        "voting_mode": result.voting_mode.value,
        "voting_breakdown": result.voting_breakdown,
        "agent_alignment": result.agent_alignment,
        "dissent_reasons": result.dissent_reasons,
        "consensus_strength": result.consensus_strength,
        "unanimity_achieved": result.unanimity_achieved,
        "supermajority_achieved": result.supermajority_achieved,
    }
