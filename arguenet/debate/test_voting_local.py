"""
Local voting algorithm test - NO API CALLS NEEDED

This file demonstrates how to test the entire voting system
without making any API calls or having tokens. Just run:

    python arguenet/debate/test_voting_local.py

You'll see examples of all voting modes in action.
"""

import sys
import json

try:
    from arguenet.debate.voting_utils import (
        create_test_argument,
        create_test_score,
        quick_vote,
        print_voting_summary,
        compare_voting_modes,
        analyze_alignment,
    )
    from arguenet.debate.voting import VotingMode
except ImportError:
    from debate.voting_utils import (
        create_test_argument,
        create_test_score,
        quick_vote,
        print_voting_summary,
        compare_voting_modes,
        analyze_alignment,
    )
    from debate.voting import VotingMode


def test_scenario_unanimity():
    """Test case: All agents strongly aligned."""
    print("\n" + "=" * 70)
    print("TEST 1: UNANIMITY - All agents strongly aligned")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Remote work increases productivity", confidence=0.92),
        create_test_argument("skeptic", "Remote work increases productivity", confidence=0.88),
        create_test_argument("devils_advocate", "Remote work increases productivity", confidence=0.85),
        create_test_argument("empiricist", "Remote work increases productivity", confidence=0.90),
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.95, evidence_quality=0.92, novelty=0.80, rebuttal_force=0.88),
        create_test_score("skeptic", relevance=0.90, evidence_quality=0.88, novelty=0.75, rebuttal_force=0.85),
        create_test_score("devils_advocate", relevance=0.85, evidence_quality=0.82, novelty=0.90, rebuttal_force=0.80),
        create_test_score("empiricist", relevance=0.92, evidence_quality=0.95, novelty=0.70, rebuttal_force=0.83),
    ]
    
    result = quick_vote(arguments, scores)
    print_voting_summary(result, verbose=True)
    
    assert result.unanimity_achieved, "Should achieve unanimity"
    assert result.voting_mode == VotingMode.UNANIMITY, "Should use UNANIMITY mode"
    print("\n✓ Test passed: Unanimity achieved")


def test_scenario_supermajority():
    """Test case: 3/4 agents aligned, one dissents."""
    print("\n" + "=" * 70)
    print("TEST 2: SUPERMAJORITY - 3/4 agents aligned")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Remote work is beneficial", confidence=0.85),
        create_test_argument("skeptic", "Remote work is beneficial", confidence=0.80),
        create_test_argument("devils_advocate", "Remote work is beneficial", confidence=0.82),
        create_test_argument("empiricist", "Remote work has drawbacks", confidence=0.45),  # Dissent
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.90, evidence_quality=0.88),
        create_test_score("skeptic", relevance=0.85, evidence_quality=0.83),
        create_test_score("devils_advocate", relevance=0.88, evidence_quality=0.85),
        create_test_score("empiricist", relevance=0.70, evidence_quality=0.60),
    ]
    
    result = quick_vote(arguments, scores)
    print_voting_summary(result, verbose=True)
    
    assert result.supermajority_achieved, "Should achieve supermajority"
    assert result.voting_mode == VotingMode.SUPERMAJORITY, "Should use SUPERMAJORITY mode"
    print("\n✓ Test passed: Supermajority achieved")


def test_scenario_weighted_consensus():
    """Test case: Diverse opinions, weighted by moderator scores."""
    print("\n" + "=" * 70)
    print("TEST 3: WEIGHTED CONSENSUS - Diverse opinions")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Remote work is definitely better", confidence=0.88),
        create_test_argument("skeptic", "Remote work is probably better", confidence=0.65),
        create_test_argument("devils_advocate", "Remote work has significant tradeoffs", confidence=0.60),
        create_test_argument("empiricist", "Studies show mixed results", confidence=0.55),
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.92, evidence_quality=0.95, novelty=0.75, rebuttal_force=0.90),
        create_test_score("skeptic", relevance=0.88, evidence_quality=0.80, novelty=0.70, rebuttal_force=0.75),
        create_test_score("devils_advocate", relevance=0.85, evidence_quality=0.75, novelty=0.95, rebuttal_force=0.70),
        create_test_score("empiricist", relevance=0.90, evidence_quality=0.98, novelty=0.60, rebuttal_force=0.65),
    ]
    
    result = quick_vote(arguments, scores)
    print_voting_summary(result, verbose=True)
    
    assert result.voting_mode == VotingMode.WEIGHTED_CONSENSUS, "Should use WEIGHTED_CONSENSUS"
    print("\n✓ Test passed: Weighted consensus applied")


def test_scenario_similarity_cluster():
    """Test case: Agents split into clusters."""
    print("\n" + "=" * 70)
    print("TEST 4: SIMILARITY CLUSTER - Agents split into groups")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Remote work is the future", confidence=0.90),
        create_test_argument("empiricist", "Remote work is the future", confidence=0.88),
        create_test_argument("skeptic", "In-office work has advantages", confidence=0.45),
        create_test_argument("devils_advocate", "In-office work has advantages", confidence=0.48),
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.92, evidence_quality=0.90),
        create_test_score("empiricist", relevance=0.90, evidence_quality=0.95),
        create_test_score("skeptic", relevance=0.75, evidence_quality=0.70),
        create_test_score("devils_advocate", relevance=0.78, evidence_quality=0.72),
    ]
    
    result = quick_vote(arguments, scores, voting_mode="similarity_cluster")
    print_voting_summary(result, verbose=True)
    
    assert result.voting_mode == VotingMode.SIMILARITY_CLUSTER, "Should use SIMILARITY_CLUSTER"
    print("\n✓ Test passed: Cluster detected")


def test_alignment_analysis():
    """Test case: Analyze agent alignment."""
    print("\n" + "=" * 70)
    print("TEST 5: ALIGNMENT ANALYSIS - Detailed breakdown")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Position A", confidence=0.85),
        create_test_argument("skeptic", "Position A", confidence=0.78),
        create_test_argument("devils_advocate", "Position B", confidence=0.60),
        create_test_argument("empiricist", "Position A", confidence=0.80),
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.90, evidence_quality=0.88),
        create_test_score("skeptic", relevance=0.88, evidence_quality=0.85),
        create_test_score("devils_advocate", relevance=0.75, evidence_quality=0.70),
        create_test_score("empiricist", relevance=0.92, evidence_quality=0.95),
    ]
    
    analysis = analyze_alignment(arguments, scores)
    print("\nAlignment Analysis:")
    print(json.dumps(analysis, indent=2))
    
    assert analysis["alignment_level"] == "supermajority", "Should detect supermajority alignment"
    assert analysis["num_agents"] == 4, "Should have 4 agents"
    print("\n✓ Test passed: Alignment correctly analyzed")


def test_compare_all_modes():
    """Test case: Compare all voting modes on same data."""
    print("\n" + "=" * 70)
    print("TEST 6: COMPARE ALL VOTING MODES")
    print("=" * 70)
    
    arguments = [
        create_test_argument("advocate", "Remote work is great", confidence=0.82),
        create_test_argument("skeptic", "Remote work has issues", confidence=0.58),
        create_test_argument("devils_advocate", "Mixed results", confidence=0.65),
        create_test_argument("empiricist", "Data is inconclusive", confidence=0.60),
    ]
    
    scores = [
        create_test_score("advocate", relevance=0.90, evidence_quality=0.85),
        create_test_score("skeptic", relevance=0.80, evidence_quality=0.75),
        create_test_score("devils_advocate", relevance=0.85, evidence_quality=0.80),
        create_test_score("empiricist", relevance=0.95, evidence_quality=0.95),
    ]
    
    comparison = compare_voting_modes(arguments, scores)
    print("\nVoting Mode Comparison:")
    print(json.dumps(comparison, indent=2))
    
    print("\n✓ All modes compared successfully")


def run_all_tests():
    """Run all test scenarios."""
    print("\n" + "🎯 " * 25)
    print("ArgueNet Voting Algorithm - LOCAL TESTS (NO API CALLS)")
    print("🎯 " * 25)
    
    try:
        test_scenario_unanimity()
        test_scenario_supermajority()
        test_scenario_weighted_consensus()
        test_scenario_similarity_cluster()
        test_alignment_analysis()
        test_compare_all_modes()
        
        print("\n" + "=" * 70)
        print("✓✓✓ ALL TESTS PASSED ✓✓✓")
        print("=" * 70)
        print("\nVoting algorithm is ready for integration!")
        print("\nNext steps:")
        print("1. Integrate KeyUpdateManager into main.py")
        print("2. Monitor voting_breakdown in consensus output")
        print("3. Adjust moderator weights if needed")
        print("4. Track voting_history for audit trails")
        print("\nSee VOTING_QUICKSTART.py for integration examples")
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
