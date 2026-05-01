"""
Utility functions and helpers for the voting algorithm.

Provides convenience functions for common voting tasks and testing.
"""

from __future__ import annotations

from typing import Optional, list as ListType
import json

try:
    from ..config import Argument, ModeratorScore
    from .voting import VotingAlgorithm, VotingMode, VotingResult
    from .key_updates import KeyUpdateManager
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore
    from voting import VotingAlgorithm, VotingMode, VotingResult
    from key_updates import KeyUpdateManager


def create_test_argument(
    agent_id: str,
    argument: str,
    confidence: float = 0.7,
    round_num: int = 1,
    claims: Optional[ListType[str]] = None,
    sources: Optional[ListType[str]] = None,
) -> Argument:
    """
    Helper to create test arguments without full API calls.
    
    Args:
        agent_id: Name of the agent
        argument: The argument text
        confidence: Agent's confidence (0.0-1.0)
        round_num: Round number
        claims: List of claims (optional)
        sources: List of sources (optional)
    
    Returns:
        Argument object ready for voting
    """
    return Argument(
        agent_id=agent_id,
        round=round_num,
        update_type="initial",
        update_reasoning="test argument",
        targets=[],
        argument=argument,
        claims=claims or [argument[:50]],
        confidence=min(1.0, max(0.0, confidence)),
        position_delta=0.0,
        sources=sources or [],
    )


def create_test_score(
    agent_id: str,
    relevance: float = 0.8,
    evidence_quality: float = 0.75,
    novelty: float = 0.7,
    rebuttal_force: float = 0.8,
    round_num: int = 1,
) -> ModeratorScore:
    """
    Helper to create test moderator scores.
    
    Args:
        agent_id: Name of the agent
        relevance: Relevance score (0.0-1.0)
        evidence_quality: Evidence quality score (0.0-1.0)
        novelty: Novelty score (0.0-1.0)
        rebuttal_force: Rebuttal force score (0.0-1.0)
        round_num: Round number
    
    Returns:
        ModeratorScore object ready for voting
    """
    # Normalize scores
    scores = {
        "relevance": min(1.0, max(0.0, relevance)),
        "evidence_quality": min(1.0, max(0.0, evidence_quality)),
        "novelty": min(1.0, max(0.0, novelty)),
        "rebuttal_force": min(1.0, max(0.0, rebuttal_force)),
    }
    
    # Calculate weighted score
    weighted = (
        scores["relevance"] * 0.35 +
        scores["evidence_quality"] * 0.35 +
        scores["novelty"] * 0.15 +
        scores["rebuttal_force"] * 0.15
    )
    
    return ModeratorScore(
        agent_id=agent_id,
        round=round_num,
        relevance=scores["relevance"],
        evidence_quality=scores["evidence_quality"],
        novelty=scores["novelty"],
        rebuttal_force=scores["rebuttal_force"],
        weighted_score=weighted,
        weakest_dimension="novelty" if scores["novelty"] == min(scores.values()) else "other",
        you_must_respond_to=[],
    )


def quick_vote(
    arguments: ListType[Argument],
    scores: ListType[ModeratorScore],
    voting_mode: Optional[str] = None,
) -> VotingResult:
    """
    Quick voting utility - one line to get consensus.
    
    Args:
        arguments: List of arguments
        scores: List of moderator scores
        voting_mode: Force specific mode (optional)
    
    Returns:
        VotingResult with consensus
    """
    voter = VotingAlgorithm()
    
    force_mode = None
    if voting_mode:
        try:
            force_mode = VotingMode(voting_mode)
        except ValueError:
            pass
    
    return voter.execute(arguments, scores, force_mode=force_mode)


def print_voting_summary(result: VotingResult, verbose: bool = False) -> None:
    """
    Pretty-print voting result.
    
    Args:
        result: VotingResult from voting algorithm
        verbose: Include detailed breakdown
    """
    print("\n" + "=" * 60)
    print("VOTING RESULT")
    print("=" * 60)
    
    print(f"\n✓ Mode:     {result.voting_mode.value}")
    print(f"✓ Answer:   {result.consensus_answer[:80]}...")
    print(f"✓ Strength: {result.consensus_strength:.1%}")
    print(f"✓ Confidence: {result.consensus_confidence:.2f}")
    
    if result.unanimity_achieved:
        print("✓ UNANIMITY ACHIEVED")
    elif result.supermajority_achieved:
        print("✓ Supermajority achieved")
    
    print("\nAgent Alignment:")
    for agent, alignment in result.agent_alignment.items():
        bar_length = int(alignment * 20)
        bar = "█" * bar_length + "░" * (20 - bar_length)
        print(f"  {agent:15} {bar} {alignment:.1%}")
    
    if result.dissent_reasons:
        print("\nDissent Reasons:")
        for reason in result.dissent_reasons:
            print(f"  • {reason}")
    
    if verbose and result.voting_breakdown:
        print("\nVoting Breakdown:")
        print(json.dumps(result.voting_breakdown, indent=2))


def compare_voting_modes(
    arguments: ListType[Argument],
    scores: ListType[ModeratorScore],
) -> dict:
    """
    Compare all voting modes on the same data.
    
    Args:
        arguments: List of arguments
        scores: List of moderator scores
    
    Returns:
        Dictionary with results from all modes
    """
    results = {}
    
    for mode in VotingMode:
        voter = VotingAlgorithm()
        result = voter.execute(arguments, scores, force_mode=mode)
        results[mode.value] = {
            "answer": result.consensus_answer[:50],
            "confidence": round(result.consensus_confidence, 3),
            "strength": round(result.consensus_strength, 3),
            "unanimity": result.unanimity_achieved,
            "supermajority": result.supermajority_achieved,
        }
    
    return results


def voting_with_callbacks(
    arguments: ListType[Argument],
    scores: ListType[ModeratorScore],
    on_vote_callback=None,
    on_update_callback=None,
) -> VotingResult:
    """
    Execute voting with callback hooks.
    
    Args:
        arguments: List of arguments
        scores: List of moderator scores
        on_vote_callback: Called with VotingResult after voting
        on_update_callback: Called with KeyUpdateEvent on each update
    
    Returns:
        VotingResult with consensus
    """
    manager = KeyUpdateManager()
    
    # Register callbacks
    if on_update_callback:
        for key in manager.VOTING_TRIGGER_KEYS:
            manager.register_trigger(key)
    
    # Notify updates
    manager.notify_update("arguments", arguments, source="system")
    manager.notify_update("scores", scores, source="system")
    
    # Execute voting
    result = manager.check_and_execute_voting(arguments, scores, force=True)
    
    if result and on_vote_callback:
        on_vote_callback(result)
    
    return result


def analyze_alignment(
    arguments: ListType[Argument],
    scores: ListType[ModeratorScore],
) -> dict:
    """
    Analyze agent alignment and suggestion for voting mode.
    
    Args:
        arguments: List of arguments
        scores: List of moderator scores
    
    Returns:
        Dictionary with alignment analysis
    """
    voter = VotingAlgorithm()
    votes = voter.build_votes(arguments, scores)
    
    if not votes:
        return {"agents": 0, "status": "no_arguments"}
    
    import statistics
    
    confidences = [v.confidence for v in votes]
    effective_confidences = [v.get_effective_confidence() for v in votes]
    
    std_dev = statistics.stdev(confidences) if len(confidences) > 1 else 0
    avg_confidence = statistics.mean(confidences)
    avg_effective = statistics.mean(effective_confidences)
    
    # Determine alignment level
    if std_dev < 0.08:
        alignment_level = "unanimous"
    elif std_dev < 0.15:
        alignment_level = "supermajority"
    elif std_dev < 0.25:
        alignment_level = "majority"
    else:
        alignment_level = "diverse"
    
    return {
        "num_agents": len(votes),
        "alignment_level": alignment_level,
        "std_dev": round(std_dev, 3),
        "avg_confidence": round(avg_confidence, 3),
        "avg_effective_confidence": round(avg_effective, 3),
        "recommended_mode": voter.select_voting_mode(votes, scores).value,
        "agent_breakdown": [
            {
                "agent": v.agent_id,
                "confidence": round(v.confidence, 3),
                "effective_confidence": round(v.get_effective_confidence(), 3),
                "has_score": v.moderator_score is not None,
            }
            for v in votes
        ],
    }


def export_voting_results(
    result: VotingResult,
    filepath: str,
) -> None:
    """
    Export voting result to JSON file.
    
    Args:
        result: VotingResult to export
        filepath: File path to save to
    """
    export_data = {
        "voting_mode": result.voting_mode.value,
        "consensus_answer": result.consensus_answer,
        "consensus_confidence": result.consensus_confidence,
        "consensus_strength": result.consensus_strength,
        "unanimity_achieved": result.unanimity_achieved,
        "supermajority_achieved": result.supermajority_achieved,
        "agent_alignment": result.agent_alignment,
        "dissent_reasons": result.dissent_reasons,
        "voting_breakdown": result.voting_breakdown,
    }
    
    with open(filepath, "w") as f:
        json.dump(export_data, f, indent=2)
    
    print(f"✓ Voting results exported to {filepath}")
