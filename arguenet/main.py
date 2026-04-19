from __future__ import annotations

import asyncio, json, sys
import os

from dotenv import load_dotenv

load_dotenv()

try:
    from .agents.base import build_agents
    from .config import Argument, MAX_ROUNDS, ModeratorScore
    from .debate.consensus import build_consensus
    from .debate.round import run_round, score_round
    from .debate.termination import should_terminate
except ModuleNotFoundError:  # pragma: no cover
    from arguenet.agents.base import build_agents
    from arguenet.config import Argument, MAX_ROUNDS, ModeratorScore
    from arguenet.debate.consensus import build_consensus
    from arguenet.debate.round import run_round, score_round
    from arguenet.debate.termination import should_terminate


async def main(question: str) -> dict:
    max_rounds = int(os.getenv("ARGUENET_MAX_ROUNDS", str(MAX_ROUNDS)))
    agents = build_agents()
    history: list[list[Argument]] = []
    all_scores: list[ModeratorScore] = []
    current: list[Argument] = []
    reason = "round_cap"
    for round_num in range(1, max_rounds + 1):
        current = await run_round(round_num, question, agents, [a for round_args in history for a in round_args], all_scores)
        scores = await score_round(round_num, question, agents["moderator"], current, [a for round_args in history for a in round_args])
        history.append(current)
        all_scores = scores
        done, reason = should_terminate(round_num, history, current)
        if done:
            break
    return build_consensus(current, all_scores, reason)


if __name__ == "__main__":
    print(json.dumps(asyncio.run(main(" ".join(sys.argv[1:]) or "Should remote work be default for software teams?")), indent=2))
