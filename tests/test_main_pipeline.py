import pytest

from arguenet.config import Argument, ModeratorScore, RoundScore
from arguenet.main import main


def _fake_argument(agent_id: str, round_num: int) -> Argument:
    return Argument(
        agent_id=agent_id,
        round=round_num,
        update_type="refine",
        update_reasoning="test reasoning",
        targets=["claim-1"],
        argument=f"{agent_id} argument",
        claims=["claim-1"],
        confidence=0.7,
        position_delta=0.1,
        sources=["https://example.com"],
    )


def _fake_score(agent_id: str, round_num: int) -> ModeratorScore:
    return ModeratorScore(
        agent_id=agent_id,
        round=round_num,
        relevance=0.8,
        evidence_quality=0.7,
        novelty=0.6,
        rebuttal_force=0.9,
        weighted_score=0.75,
        weakest_dimension="novelty",
        you_must_respond_to=["add more novelty"],
    )


def _fake_round_score(round_num: int) -> RoundScore:
    return RoundScore(
        round=round_num,
        winner="advocate",
        winner_score=82.0,
        all_scores={"advocate": 82.0, "skeptic": 78.0},
        all_arguments={"advocate": "A", "skeptic": "S"},
        feedback_for_agents={"skeptic": "push stronger evidence"},
        fact_checks={"advocate": "mostly supported", "skeptic": "partially supported"},
        summary=f"round {round_num} summary",
        key_insights=["insight 1", "insight 2"],
    )


@pytest.mark.asyncio
async def test_main_builds_consensus_and_emits_round_events(monkeypatch: pytest.MonkeyPatch):
    emitted_rounds = []

    async def fake_run_round(round_num, question, agents, history, all_scores, feedback):
        return [_fake_argument("advocate", round_num), _fake_argument("skeptic", round_num)]

    async def fake_score_round(round_num, question, moderator, current, history):
        return [_fake_score("advocate", round_num), _fake_score("skeptic", round_num)]

    async def fake_run_scorer(round_num, question, scorer, current, scores, history):
        return _fake_round_score(round_num)

    def fake_should_terminate(round_num, history, current):
        return (round_num >= 2, "quorum")

    def fake_build_consensus(current, all_scores, reason):
        return {
            "answer": "consensus answer",
            "confidence": 0.88,
            "termination_reason": reason,
            "dissent_log": [],
        }

    monkeypatch.setattr(
        "arguenet.main.build_agents",
        lambda **kwargs: {"advocate": object(), "skeptic": object(), "moderator": object(), "scorer": object()},
    )
    monkeypatch.setattr("arguenet.main.run_round", fake_run_round)
    monkeypatch.setattr("arguenet.main.score_round", fake_score_round)
    monkeypatch.setattr("arguenet.main.run_scorer", fake_run_scorer)
    monkeypatch.setattr("arguenet.main.should_terminate", fake_should_terminate)
    monkeypatch.setattr("arguenet.main.build_consensus", fake_build_consensus)

    result = await main("Should remote work be default?", on_round=lambda payload: emitted_rounds.append(payload))

    assert result["answer"] == "consensus answer"
    assert result["termination_reason"] == "quorum"
    assert len(result["round_scores"]) == 2
    assert len(emitted_rounds) == 2
    assert emitted_rounds[0]["winner"] == "advocate"


@pytest.mark.asyncio
async def test_main_honors_arguenet_max_rounds_env(monkeypatch: pytest.MonkeyPatch):
    rounds_seen = []

    async def fake_run_round(round_num, question, agents, history, all_scores, feedback):
        rounds_seen.append(round_num)
        return [_fake_argument("advocate", round_num)]

    async def fake_score_round(round_num, question, moderator, current, history):
        return [_fake_score("advocate", round_num)]

    async def fake_run_scorer(round_num, question, scorer, current, scores, history):
        return _fake_round_score(round_num)

    monkeypatch.setenv("ARGUENET_MAX_ROUNDS", "1")
    monkeypatch.setattr(
        "arguenet.main.build_agents",
        lambda **kwargs: {"advocate": object(), "moderator": object(), "scorer": object()},
    )
    monkeypatch.setattr("arguenet.main.run_round", fake_run_round)
    monkeypatch.setattr("arguenet.main.score_round", fake_score_round)
    monkeypatch.setattr("arguenet.main.run_scorer", fake_run_scorer)
    monkeypatch.setattr("arguenet.main.should_terminate", lambda *args, **kwargs: (False, "round_cap"))
    monkeypatch.setattr(
        "arguenet.main.build_consensus",
        lambda current, all_scores, reason: {
            "answer": "single round answer",
            "confidence": 0.5,
            "termination_reason": reason,
            "dissent_log": [],
        },
    )

    result = await main("Test question")

    assert rounds_seen == [1]
    assert len(result["round_scores"]) == 1
    assert result["termination_reason"] == "round_cap"
