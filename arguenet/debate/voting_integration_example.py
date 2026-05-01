"""
Example: Integrating the voting algorithm into main.py

This file demonstrates how to use the VotingAlgorithm and KeyUpdateManager
in your main debate loop.
"""

from __future__ import annotations

import asyncio
import json
import sys
import os

from dotenv import load_dotenv

try:
    from arguenet.agents.base import build_agents
    from arguenet.config import Argument, MAX_ROUNDS, ModeratorScore
    from arguenet.debate.consensus import build_consensus
    from arguenet.debate.round import run_round, score_round
    from arguenet.debate.termination import should_terminate
    from arguenet.debate.key_updates import KeyUpdateManager
    from arguenet.debate.voting import VotingMode
except ModuleNotFoundError:  # pragma: no cover
    from arguenet.agents.base import build_agents
    from arguenet.config import Argument, MAX_ROUNDS, ModeratorScore
    from arguenet.debate.consensus import build_consensus
    from arguenet.debate.round import run_round, score_round
    from arguenet.debate.termination import should_terminate
    from arguenet.debate.key_updates import KeyUpdateManager
    from arguenet.debate.voting import VotingMode

load_dotenv()


async def main_with_voting(question: str, auto_voting: bool = True) -> dict:
    """
    Main debate loop with integrated voting algorithm.
    
    Args:
        question: The debate question
        auto_voting: Enable automatic voting on key updates (default: True)
    
    Returns:
        Consensus with voting transparency
    """
    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    print("max rounds", max_rounds)
    
    agents = build_agents()
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    current: list[Argument] = []
    reason = "round_cap"
    
    # Initialize the key update manager for automatic voting triggers
    update_manager = KeyUpdateManager()
    
    # Optional: Register custom callback for voting results
    def on_voting_result(result):
        print(f"✓ Voting triggered: {result.voting_mode.value}")
        print(f"  Consensus strength: {result.consensus_strength:.2%}")
        print(f"  Agent alignment: {result.agent_alignment}")
    
    if auto_voting:
        # Register callback to see voting results
        for key in update_manager.VOTING_TRIGGER_KEYS:
            update_manager.register_trigger(key, callback=on_voting_result)
    
    for round_num in range(1, max_rounds + 1):
        print(f"\nRound {round_num} starting...")
        
        # Run debate round
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores)
        print("Arguments generated")
        
        # Notify key update manager about new arguments
        if auto_voting:
            update_manager.notify_update("arguments", current, source="agents")
        
        # Score arguments
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        print(f"Scores calculated for {len(scores)} agents")
        
        # Notify key update manager about new scores
        if auto_voting:
            update_manager.notify_update("scores", scores, source="moderator")
        
        # Check if voting should be executed (optional intermediate voting)
        if auto_voting:
            voting_result = update_manager.check_and_execute_voting(current, scores)
            if voting_result:
                print(f"Intermediate consensus strength: {voting_result.consensus_strength:.2%}")
        
        # Update history and scores
        history.append(current)
        all_scores = scores
        
        # Check termination condition
        done, reason = should_terminate(round_num, history, current)
        if done:
            print(f"Debate terminated: {reason}")
            break
    
    # Final consensus with voting
    print(f"\nBuilding final consensus from {len(current)} arguments...")
    final_consensus = build_consensus(current, all_scores, reason)
    
    if auto_voting:
        print(f"\nFinal voting mode: {final_consensus.get('voting_mode', 'unknown')}")
        print(f"Consensus strength: {final_consensus.get('consensus_strength', 0):.2%}")
        print(f"Agent alignment:")
        for agent, alignment in final_consensus.get('agent_alignment', {}).items():
            print(f"  {agent}: {alignment:.2%}")
    
    return final_consensus


async def main_with_forced_voting(question: str, voting_mode: str = "weighted_consensus") -> dict:
    """
    Main debate loop with forced voting mode.
    
    Useful for testing specific voting strategies.
    
    Args:
        question: The debate question
        voting_mode: Force specific voting mode
    
    Returns:
        Consensus with specified voting mode
    """
    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    
    agents = build_agents()
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    current: list[Argument] = []
    reason = "round_cap"
    
    for round_num in range(1, max_rounds + 1):
        print(f"Round {round_num}...")
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores)
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        
        history.append(current)
        all_scores = scores
        
        done, reason = should_terminate(round_num, history, current)
        if done:
            break
    
    # Build consensus with forced voting mode
    print(f"\nUsing voting mode: {voting_mode}")
    final_consensus = build_consensus(current, all_scores, reason, voting_mode=voting_mode)
    
    return final_consensus


async def main_with_intermediate_voting(question: str) -> dict:
    """
    Main debate loop that stops early if strong consensus is reached.
    
    Uses voting algorithm to detect when consensus is strong enough
    and terminates debate early to save compute.
    
    Args:
        question: The debate question
    
    Returns:
        Consensus, potentially reached early
    """
    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    early_termination_threshold = 0.85  # Stop if consensus strength > 85%
    
    agents = build_agents()
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    current: list[Argument] = []
    reason = "round_cap"
    
    update_manager = KeyUpdateManager()
    
    for round_num in range(1, max_rounds + 1):
        print(f"Round {round_num}...")
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores)
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        
        # Check intermediate consensus
        update_manager.notify_update("arguments", current, source="agents")
        update_manager.notify_update("scores", scores, source="moderator")
        voting_result = update_manager.check_and_execute_voting(current, scores, force=True)
        
        if voting_result and voting_result.consensus_strength > early_termination_threshold:
            print(f"Strong consensus reached: {voting_result.consensus_strength:.2%}")
            print("Terminating debate early")
            reason = "strong_consensus"
            history.append(current)
            all_scores = scores
            break
        
        history.append(current)
        all_scores = scores
        
        done, reason = should_terminate(round_num, history, current)
        if done:
            break
    
    final_consensus = build_consensus(current, all_scores, reason)
    return final_consensus


if __name__ == "__main__":
    print("ArgueNet with Voting Algorithm")
    print("=" * 50)
    
    question = " ".join(sys.argv[1:]) or "Should remote work be default for software teams?"
    
    # Example 1: Auto voting (recommended)
    print("\n[Example 1] Running with automatic voting...")
    result = asyncio.run(main_with_voting(question, auto_voting=True))
    print(json.dumps(result, indent=2))
    
    # Example 2: Forced voting mode
    # print("\n[Example 2] Running with forced weighted consensus voting...")
    # result = asyncio.run(main_with_forced_voting(question, voting_mode="weighted_consensus"))
    # print(json.dumps(result, indent=2))
    
    # Example 3: Early termination on strong consensus
    # print("\n[Example 3] Running with early termination threshold...")
    # result = asyncio.run(main_with_intermediate_voting(question))
    # print(json.dumps(result, indent=2))
