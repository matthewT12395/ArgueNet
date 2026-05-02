from __future__ import annotations

import asyncio, json, sys
import os

from dotenv import load_dotenv

load_dotenv()

try:
    from arguenet.agents.base import build_agents
    from .config import Argument, MAX_ROUNDS, ModeratorScore, RoundScore
    from .debate.consensus import build_consensus
    from .debate.round import run_round, score_round, run_scorer
    from .debate.termination import should_terminate
except ModuleNotFoundError:  # pragma: no cover
    from arguenet.agents.base import build_agents
    from arguenet.config import Argument, MAX_ROUNDS, ModeratorScore, RoundScore
    from arguenet.debate.consensus import build_consensus
    from arguenet.debate.round import run_round, score_round, run_scorer
    from arguenet.debate.termination import should_terminate


async def main(question: str) -> dict:
    
    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    print("max rounds ", max_rounds)
    agents = build_agents()
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    all_round_scores: list[RoundScore] = []  # Track round scores with feedback
    current: list[Argument] = []
    reason = "round_cap"
    current_feedback: dict[str, str] = {}  # Feedback from previous round
    
    for round_num in range(1, max_rounds + 1):
        print(f"\n=== Round {round_num} ===")
        
        # Run the debate round (with feedback from previous round if available)
        print("Running arguments...")
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores, feedback=current_feedback)
        print("Arguments completed")
        
        # Score the arguments
        print("Scoring arguments...")
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        print("Scoring completed")
        
        # Run the scorer agent to generate feedback
        print("Running scorer agent...")
        round_score = await run_scorer(round_num, question, agents["scorer"], current, scores, [a for round_args in history for a in round_args])
        print(f"Scorer results: Winner = {round_score.winner}, Summary = {round_score.summary}")
        
        # Extract feedback for next round
        current_feedback = round_score.feedback_for_agents
        
        history.append(current)
        all_scores = scores
        all_round_scores.append(round_score)
        
        # Check termination
        done, reason = should_terminate(round_num, history, current)
        if done:
            print(f"Debate terminated: {reason}")
            break
    
    # Build final consensus with all round scores
    consensus = build_consensus(current, all_scores, reason)
    consensus["round_scores"] = [rs.model_dump() for rs in all_round_scores]
    return consensus


if __name__ == "__main__":
    print("starting...")
    print(json.dumps(asyncio.run(main(" ".join(sys.argv[1:]) or "Should remote work be default for software teams?")), indent=2))
