from fastapi.testclient import TestClient

from orchestrator import app as orchestrator_app


def _mock_pipeline_result() -> dict:
    return {
        "answer": "Mock consensus",
        "confidence": 0.91,
        "termination_reason": "quorum",
        "reasoning_trace": ["advocate trace", "critic trace"],
        "dissent_log": [{"agent": "skeptic", "objection": "Need stronger evidence."}],
        "round_scores": [
            {
                "round": 1,
                "winner": "advocate",
                "all_scores": {"advocate": 88.0, "skeptic": 77.0},
                "all_arguments": {"advocate": "pro argument", "skeptic": "counter argument"},
                "feedback_for_agents": {"skeptic": "cite better data"},
                "fact_checks": {"advocate": "supported"},
                "summary": "Round summary",
                "key_insights": ["insight"],
            }
        ],
    }


def test_health_endpoint():
    client = TestClient(orchestrator_app.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_debate_and_fetch_by_id(monkeypatch):
    def fake_execute_debate(**kwargs):
        return orchestrator_app._finalize_debate_record(
            debate_id="debate-123",
            created_at="2026-01-01T00:00:00",
            question=kwargs["question"],
            pipeline_result=_mock_pipeline_result(),
            simulate_failure=False,
            failed_node=None,
        )

    monkeypatch.setattr(orchestrator_app, "execute_debate", fake_execute_debate)
    orchestrator_app.debates.clear()

    client = TestClient(orchestrator_app.app)
    payload = {"question": "Should companies use remote work by default?"}
    create_resp = client.post("/debate", json=payload)
    assert create_resp.status_code == 200

    body = create_resp.json()
    assert body["status"] == "completed"
    assert body["final_answer"] == "Mock consensus"
    assert body["quorum_met"] is True
    assert len(body["messages"]) >= 2


def test_create_debate_rejects_empty_question():
    client = TestClient(orchestrator_app.app)
    response = client.post("/debate", json={"question": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Question cannot be empty."


def test_debates_list_sorted_descending():
    orchestrator_app.debates.clear()
    orchestrator_app.debates["older"] = {
        "debate_id": "older",
        "question": "old",
        "status": "completed",
        "round": 1,
        "created_at": "2026-01-01T00:00:00",
    }
    orchestrator_app.debates["newer"] = {
        "debate_id": "newer",
        "question": "new",
        "status": "completed",
        "round": 2,
        "created_at": "2026-01-02T00:00:00",
    }

    client = TestClient(orchestrator_app.app)
    response = client.get("/debates")
    assert response.status_code == 200
    debates = response.json()["debates"]
    assert [row["debate_id"] for row in debates] == ["newer", "older"]


def test_get_debate_returns_404_when_missing():
    orchestrator_app.debates.clear()
    client = TestClient(orchestrator_app.app)
    response = client.get("/debate/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Debate not found."


def test_debate_stream_emits_logs_then_result(monkeypatch):
    def fake_run_debate_with_stdout_tee(
        question,
        log_q,
        outcome,
        max_rounds,
        personal_agent_profile,
        personal_agent_profiles,
        selected_example_agents,
    ):
        log_q.put({"event": "log", "text": "ROUND 1\n"})
        log_q.put({"event": "round_complete", "round": 1, "winner": "advocate"})
        outcome["result"] = _mock_pipeline_result()
        log_q.put(orchestrator_app._LOG_QUEUE_END)

    monkeypatch.setattr(orchestrator_app, "_run_debate_with_stdout_tee", fake_run_debate_with_stdout_tee)
    orchestrator_app.debates.clear()

    client = TestClient(orchestrator_app.app)
    with client.stream(
        "POST",
        "/debate/stream",
        json={"question": "Is hybrid work the right default?"},
    ) as response:
        assert response.status_code == 200
        chunks = [line for line in response.iter_lines() if line]

    import json

    events = [json.loads(chunk) for chunk in chunks]
    event_types = [e.get("event") for e in events]
    assert event_types[0] == "log"
    assert "round_complete" in event_types
    assert event_types[-1] == "result"

    result_event = events[-1]
    assert result_event["debate"]["status"] == "completed"
    assert result_event["debate"]["final_answer"] == "Mock consensus"
