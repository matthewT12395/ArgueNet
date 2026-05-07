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

async def main(
    question: str,
    personal_agent_profile: dict[str, str] | None = None,
    personal_agent_profiles: list[dict[str, str]] | None = None,
    selected_example_agents: list[str] | None = None,
    on_round: "callable | None" = None,
) -> dict:

    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    print("max rounds ", max_rounds)
    agents = build_agents(
        personal_profile=personal_agent_profile,
        personal_profiles=personal_agent_profiles,
        example_agent_ids=selected_example_agents,
    )
    if personal_agent_profile:
        name = (personal_agent_profile.get("name") or "PersonalAgent").strip()
        print(f"Personal agent enabled: {name}")
    if personal_agent_profiles:
        print(f"Additional friend agents enabled: {len(personal_agent_profiles)}")
    if selected_example_agents:
        print(f"Example agents enabled: {', '.join(selected_example_agents)}")
    debate_agents = [name for name in agents if name not in {"moderator", "scorer"}]
    print(f"Active debate agents ({len(debate_agents)}): {', '.join(debate_agents)}")
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    all_round_scores: list[RoundScore] = []  # Track round scores with feedback
    current: list[Argument] = []
    reason = "round_cap"
    current_feedback: dict[str, str] = {}  # Feedback from previous round

    for round_num in range(1, max_rounds + 1):
        print(f"\n{'='*80}")
        print(f"ROUND {round_num}")
        print(f"{'='*80}")

        # Run the debate round (with feedback from previous round if available)
        print("Running arguments...")
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores, feedback=current_feedback)
        print("Arguments completed")

        # Score the arguments
        print("Scoring arguments...")
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        print("Scoring completed")

        # Run the scorer agent to generate feedback
        print("Running fact-checking and ranking evaluation...")
        round_score = await run_scorer(round_num, question, agents["scorer"], current, scores, [a for round_args in history for a in round_args])
        print(f"Scorer results: Winner = {round_score.winner}, Summary = {round_score.summary}")

        # Print rankings
        print(f"\n{'='*80}")
        print(f"RANKINGS - ROUND {round_num}")
        print(f"{'='*80}")

        # Sort agents by score (descending)
        sorted_scores = sorted(round_score.all_scores.items(), key=lambda x: x[1], reverse=True)

        for rank, (agent_id, score) in enumerate(sorted_scores, 1):
            status = "🏆 WINNER" if rank == 1 else ""
            print(f"{rank}. {agent_id:20} - Score: {score:6.2f}/100 {status}")

            # Print fact-checks if available
            if agent_id in round_score.fact_checks:
                print(f"   Fact-Check: {round_score.fact_checks[agent_id]}")

        print(f"\nRound Summary: {round_score.summary}")
        print(f"Key Insights: {', '.join(round_score.key_insights)}")

        # Extract feedback for next round
        current_feedback = round_score.feedback_for_agents

        history.append(current)
        all_scores = scores
        all_round_scores.append(round_score)

        # Notify external observers (orchestrator stream) with the per-round result.
        if on_round is not None:
            try:
                on_round(round_score.model_dump())
            except Exception as cb_exc:  # pragma: no cover
                print(f"[on_round callback error] {cb_exc}")

        # Check termination
        done, reason = should_terminate(round_num, history, current)
        if done:
            print(f"\n{'='*80}")
            print(f"DEBATE TERMINATED: {reason}")
            print(f"{'='*80}\n")
            break

    # Build final consensus with all round scores
    consensus = build_consensus(current, all_scores, reason)
    consensus["round_scores"] = [rs.model_dump() for rs in all_round_scores]

    # Print final cumulative rankings
    print(f"\n{'='*80}")
    print("FINAL CUMULATIVE RANKINGS (All Rounds)")
    print(f"{'='*80}")

    # Calculate cumulative scores
    cumulative_scores: dict[str, float] = {}
    for round_score in all_round_scores:
        for agent_id, score in round_score.all_scores.items():
            if agent_id not in cumulative_scores:
                cumulative_scores[agent_id] = 0.0
            cumulative_scores[agent_id] += score

    # Calculate averages
    num_rounds = len(all_round_scores)
    if num_rounds > 0:
        avg_scores = {agent: total / num_rounds for agent, total in cumulative_scores.items()}
        sorted_avg = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)

        for rank, (agent_id, avg_score) in enumerate(sorted_avg, 1):
            total_score = cumulative_scores[agent_id]
            status = "🏆 OVERALL WINNER" if rank == 1 else ""
            print(f"{rank}. {agent_id:20} - Avg Score: {avg_score:6.2f}/100, Total: {total_score:7.2f} {status}")

    print(f"\n{'='*80}\n")
    return consensus


if __name__ == "__main__":
    print("starting...")
    print(json.dumps(asyncio.run(main(" ".join(sys.argv[1:]) or "Should remote work be default for software teams?")), indent=2))
