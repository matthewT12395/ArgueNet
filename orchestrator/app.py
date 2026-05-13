from __future__ import annotations

import asyncio
import contextlib
import json
import os
import queue
import sys
import threading
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Dict, Iterator, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# Load Kafka + Grafana Cloud credentials from env file if present (local dev / Render).
# On Render the env vars are set via dashboard; load_dotenv is a no-op in that case.
try:
    from dotenv import load_dotenv
    _env_file = ROOT_DIR / "monitoring" / "grafana_cloud.env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)  # override=False: dashboard vars win
except ImportError:
    pass

from arguenet.main import main as _run_main
try:
    from arguenet.kafka_main import main as _run_kafka_main  # type: ignore
except Exception:  # pragma: no cover - kafka deps optional
    _run_kafka_main = None  # type: ignore
try:
    from arguenet.messaging.health import ensure_topics  # type: ignore
except Exception:  # pragma: no cover - kafka deps optional
    ensure_topics = None  # type: ignore


def _debate_runner():
    """Return kafka_main.main when ARGUENET_USE_KAFKA=1, else arguenet.main.main."""
    if os.getenv("ARGUENET_USE_KAFKA", "0") == "1" and _run_kafka_main is not None:
        return _run_kafka_main
    return _run_main


@contextlib.asynccontextmanager
async def _lifespan(app_: FastAPI):
    """Optionally ensure Kafka topics exist. Disabled unless ARGUENET_USE_KAFKA=1."""
    if os.getenv("ARGUENET_USE_KAFKA", "0") == "1" and ensure_topics is not None:
        try:
            bs = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
            rf = 3 if ".confluent.cloud" in bs else 1
            status = ensure_topics(replication_factor=rf)
            for topic, state in status.items():
                print(f"[kafka] {topic}: {state}")
        except Exception as exc:
            print(f"[kafka] topic setup warning: {exc}")
    else:
        print("[kafka] disabled (set ARGUENET_USE_KAFKA=1 to enable topic setup)")
    yield


app = FastAPI(title="ArgueNet Orchestrator", version="0.2.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# In-memory storage
# ----------------------------
debates: Dict[str, dict] = {}
ROLE_ORDER = ["advocate", "critic", "moderator"]

_LOG_QUEUE_END = object()
_ROUNDS_ENV_LOCK = threading.Lock()
_DEBATE_MAX_ROUNDS_CAP = 20


@contextlib.contextmanager
def _max_rounds_env(value: Optional[int]) -> Iterator[None]:
    """Temporarily set ARGUENET_MAX_ROUNDS for one debate (process-global env; serialized)."""
    if value is None:
        yield
        return
    key = "ARGUENET_MAX_ROUNDS"
    with _ROUNDS_ENV_LOCK:
        saved = os.environ.get(key)
        os.environ[key] = str(value)
        try:
            yield
        finally:
            if saved is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = saved


class _StdoutLineTee:
    """Copy stdout to the original stream and enqueue each completed line for NDJSON logs."""

    def __init__(self, underlying: object, log_q: "queue.SimpleQueue") -> None:
        self._underlying = underlying
        self._q = log_q
        self._buffer = ""

    @property
    def encoding(self) -> str:
        return getattr(self._underlying, "encoding", None) or "utf-8"

    @property
    def errors(self) -> str | None:
        return getattr(self._underlying, "errors", None)

    def isatty(self) -> bool:
        return False

    def writable(self) -> bool:
        return True

    def write(self, s: str) -> int:
        if not isinstance(s, str):
            s = str(s)
        self._underlying.write(s)  # type: ignore[attr-defined]
        self._buffer += s
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            self._q.put({"event": "log", "text": line + "\n"})
        return len(s)

    def flush(self) -> None:
        self._underlying.flush()  # type: ignore[attr-defined]

    def drain_pending(self) -> str | None:
        rest = self._buffer
        self._buffer = ""
        if not rest:
            return None
        return rest if rest.endswith("\n") else rest + "\n"


def _run_debate_with_stdout_tee(
    question: str,
    log_q: queue.SimpleQueue,
    outcome: dict,
    max_rounds: Optional[int],
    personal_agent_profile: Optional[dict],
    personal_agent_profiles: Optional[List[dict]],
    selected_example_agents: Optional[List[str]],
) -> None:
    """Runs asyncio.run(main) in a worker thread while teeing stdout to log_q."""
    import logging as _logging

    old_out = sys.stdout
    tee = _StdoutLineTee(old_out, log_q)
    sys.stdout = tee  # type: ignore[assignment]

    # Attach a handler so warnings/errors from kafka_main reach the tee;
    # INFO-level coordination noise is filtered out — only print() output shows.
    stream_handler = _logging.StreamHandler(tee)  # type: ignore[arg-type]
    stream_handler.setFormatter(_logging.Formatter("%(message)s"))
    stream_handler.setLevel(_logging.WARNING)
    arguenet_logger = _logging.getLogger("arguenet")
    arguenet_logger.addHandler(stream_handler)
    arguenet_logger.setLevel(_logging.INFO)

    def _on_round(round_score: dict) -> None:
        # Push a structured event into the NDJSON stream so the frontend
        # can render round-by-round visualizations without screen-scraping.
        try:
            log_q.put({"event": "round_complete", **round_score})
        except Exception:
            pass

    try:
        with _max_rounds_env(max_rounds):
            outcome["result"] = asyncio.run(
                _debate_runner()(
                    question,
                    personal_agent_profile=personal_agent_profile,
                    personal_agent_profiles=personal_agent_profiles,
                    selected_example_agents=selected_example_agents,
                    on_round=_on_round,
                )
            )
    except Exception as exc:
        outcome["error"] = exc
    finally:
        arguenet_logger.removeHandler(stream_handler)
        sys.stdout = old_out
        pending = tee.drain_pending()
        if pending:
            log_q.put({"event": "log", "text": pending})
        log_q.put(_LOG_QUEUE_END)


# ----------------------------
# Request / Response Models
# ----------------------------
class PersonalAgentProfile(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    background: Optional[str] = Field(default="", max_length=1000)
    hobbies: Optional[str] = Field(default="", max_length=1000)
    interests: Optional[str] = Field(default="", max_length=1000)
    beliefs: Optional[str] = Field(default="", max_length=1000)
    communication_style: Optional[str] = Field(default="", max_length=500)


class DebateRequest(BaseModel):
    question: str
    simulate_failure: Optional[bool] = False
    failed_node: Optional[str] = None  # advocate | critic | moderator
    personal_agent: Optional[PersonalAgentProfile] = Field(
        default=None,
        description="Placeholder for frontend custom persona fields used to create a runtime personal agent.",
    )
    personal_agents: List[PersonalAgentProfile] = Field(
        default_factory=list,
        description="Optional list of additional friend agents to include in this run.",
    )
    selected_example_agents: List[str] = Field(
        default_factory=list,
        description="Optional list of predefined example agent IDs (for example: policy_hawk, startup_founder).",
    )
    max_rounds: Optional[int] = Field(
        default=None,
        ge=1,
        le=_DEBATE_MAX_ROUNDS_CAP,
        description="Sets ARGUENET_MAX_ROUNDS for this run; omit to use server env / arguenet default.",
    )


class AgentMessage(BaseModel):
    sender: str
    position: str
    content: str
    confidence: float
    round: int
    timestamp: str


class DebateResponse(BaseModel):
    debate_id: str
    question: str
    status: str
    round: int
    messages: List[AgentMessage]
    final_answer: str
    agreement_score: float
    quorum_met: bool
    failed_nodes: List[str]
    created_at: str
    participants: List[AgentMessage] = []
    trace_id: Optional[str] = None


class DebateSummary(BaseModel):
    debate_id: str
    question: str
    status: str
    round: int
    created_at: str


class DebatesListResponse(BaseModel):
    debates: List[DebateSummary]


def _extract_role_texts(result: dict) -> dict[str, str]:
    role_text = {role: "" for role in ROLE_ORDER}
    dissent_items = result.get("dissent_log", []) or []

    for item in dissent_items:
        agent = str(item.get("agent", "")).lower()
        objection = str(item.get("objection", "")).strip()
        if not objection:
            continue
        if "advocate" in agent and not role_text["advocate"]:
            role_text["advocate"] = objection
        elif any(token in agent for token in ["skeptic", "devils", "critic"]) and not role_text["critic"]:
            role_text["critic"] = objection

    trace = [str(x).strip() for x in (result.get("reasoning_trace", []) or []) if str(x).strip()]
    for idx, role in enumerate(["advocate", "critic"]):
        if not role_text[role] and idx < len(trace):
            role_text[role] = trace[idx]

    role_text["moderator"] = (
        f"Termination reason: {result.get('termination_reason', 'unknown')}. "
        f"Consensus confidence: {float(result.get('confidence', 0.0)):.2f}."
    )
    return role_text


def _build_messages(result: dict, failed_nodes: List[str], round_num: int) -> List[dict]:
    """Build a list of messages from the pipeline result."""
    now = datetime.utcnow().isoformat()
    role_text = _extract_role_texts(result)
    messages: List[dict] = []

    for role in ROLE_ORDER:
        if role in failed_nodes:
            continue
        messages.append(
            {
                "sender": role,
                "position": "neutral" if role == "moderator" else ("support" if role == "advocate" else "oppose"),
                "content": role_text.get(role) or "No response generated.",
                "confidence": round(float(result.get("confidence", 0.0)), 2),
                "round": round_num,
                "timestamp": now,
            }
        )
    return messages


def _build_participants(result: dict, failed_nodes: List[str], round_num: int) -> List[dict]:
    now = datetime.utcnow().isoformat()
    confidence = round(float(result.get("confidence", 0.0)), 2)
    participants: List[dict] = []
    used: set[str] = set()

    round_scores = result.get("round_scores")
    if isinstance(round_scores, list) and round_scores:
        last = round_scores[-1] if isinstance(round_scores[-1], dict) else {}
        all_arguments = last.get("all_arguments") if isinstance(last, dict) else {}
        if isinstance(all_arguments, dict):
            for agent_id, content in all_arguments.items():
                sender = str(agent_id)
                if sender in failed_nodes:
                    continue
                participants.append(
                    {
                        "sender": sender,
                        "position": "participant",
                        "content": str(content),
                        "confidence": confidence,
                        "round": round_num,
                        "timestamp": now,
                    }
                )
                used.add(sender)

    dissent_items = result.get("dissent_log", []) or []
    for item in dissent_items:
        sender = str(item.get("agent", "")).strip()
        if not sender or sender in used or sender in failed_nodes:
            continue
        participants.append(
            {
                "sender": sender,
                "position": "participant",
                "content": str(item.get("objection", "")).strip() or "No response generated.",
                "confidence": confidence,
                "round": round_num,
                "timestamp": now,
            }
        )
        used.add(sender)

    return participants


def _payload_personal_agents(payload: DebateRequest) -> List[dict]:
    return [profile.model_dump(exclude_none=True) for profile in payload.personal_agents]


# ----------------------------
# Debate runner
# ----------------------------
def _finalize_debate_record(
    *,
    debate_id: str,
    created_at: str,
    question: str,
    pipeline_result: dict,
    simulate_failure: bool,
    failed_node: Optional[str],
) -> dict:
    rs = pipeline_result.get("round_scores")
    n = len(rs) if isinstance(rs, list) else 0
    round_num = max(1, n) if n else 1
    failed_nodes: List[str] = []
    if simulate_failure and failed_node in ROLE_ORDER:
        failed_nodes.append(failed_node)

    messages = _build_messages(pipeline_result, failed_nodes, round_num)
    participants = _build_participants(pipeline_result, failed_nodes, round_num)
    if not messages or len(messages) < 2:
        status = "failed"
        quorum_met = False
    elif simulate_failure and failed_node == "moderator":
        status = "failed"
        quorum_met = False
    else:
        status = "completed"
        quorum_met = True

    final_answer = str(pipeline_result.get("answer", "")).strip() or "No consensus answer returned."
    agreement_score = round(float(pipeline_result.get("confidence", 0.0)), 2)
    return {
        "debate_id": debate_id,
        "question": question,
        "status": status,
        "round": round_num,
        "messages": messages,
        "final_answer": final_answer,
        "agreement_score": agreement_score,
        "quorum_met": quorum_met,
        "failed_nodes": failed_nodes,
        "created_at": created_at,
        "participants": participants,
        "trace_id": pipeline_result.get("trace_id"),
    }


def execute_debate(
    question: str,
    simulate_failure: bool = False,
    failed_node: Optional[str] = None,
    max_rounds: Optional[int] = None,
    personal_agent_profile: Optional[dict] = None,
    personal_agent_profiles: Optional[List[dict]] = None,
    selected_example_agents: Optional[List[str]] = None,
) -> dict:
    debate_id = str(uuid4())
    created_at = datetime.utcnow().isoformat()
    round_num = 1
    failed_nodes: List[str] = []
    if simulate_failure and failed_node in ROLE_ORDER:
        failed_nodes.append(failed_node)

    try:
        with _max_rounds_env(max_rounds):
            pipeline_result = asyncio.run(
                _debate_runner()(
                    question,
                    personal_agent_profile=personal_agent_profile,
                    personal_agent_profiles=personal_agent_profiles,
                    selected_example_agents=selected_example_agents,
                )
            )
    except Exception as exc:
        return {
            "debate_id": debate_id,
            "question": question,
            "status": "failed",
            "round": round_num,
            "messages": [],
            "final_answer": f"Debate execution failed: {exc}",
            "agreement_score": 0.0,
            "quorum_met": False,
            "failed_nodes": failed_nodes,
            "created_at": created_at,
            "participants": [],
        }

    debate_record = _finalize_debate_record(
        debate_id=debate_id,
        created_at=created_at,
        question=question,
        pipeline_result=pipeline_result,
        simulate_failure=simulate_failure,
        failed_node=failed_node,
    )
    debates[debate_id] = debate_record
    return debate_record


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health_check():
    """
    Check the health status of the Orchestrator service.
    """
    return {"status": "ok", "service": "orchestrator"}


@app.post("/debate", response_model=DebateResponse)
def create_debate(payload: DebateRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = execute_debate(
        question=question,
        simulate_failure=payload.simulate_failure,
        failed_node=payload.failed_node,
        max_rounds=payload.max_rounds,
        personal_agent_profile=(
            payload.personal_agent.model_dump(exclude_none=True) if payload.personal_agent else None
        ),
        personal_agent_profiles=_payload_personal_agents(payload),
        selected_example_agents=list(payload.selected_example_agents),
    )
    return result


@app.post("/debate/stream")
async def create_debate_stream(payload: DebateRequest):
    """
    NDJSON stream: `log` lines (stdout from `arguenet.main`, same as the CLI), then
    `result` with the same shape as POST /debate, or `error` on failure.
    """
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    debate_id = str(uuid4())
    created_at = datetime.utcnow().isoformat()
    failed_nodes: List[str] = []
    if payload.simulate_failure and payload.failed_node in ROLE_ORDER:
        failed_nodes.append(payload.failed_node)

    async def ndjson_body():
        yield json.dumps({"event": "log", "text": "starting...\n"}) + "\n"
        log_q: queue.SimpleQueue = queue.SimpleQueue()
        outcome: dict = {}
        loop = asyncio.get_running_loop()
        exec_fut = loop.run_in_executor(
            None,
            partial(
                _run_debate_with_stdout_tee,
                question,
                log_q,
                outcome,
                payload.max_rounds,
                payload.personal_agent.model_dump(exclude_none=True) if payload.personal_agent else None,
                _payload_personal_agents(payload),
                list(payload.selected_example_agents),
            ),
        )
        try:
            while True:
                item = await asyncio.to_thread(log_q.get)
                if item is _LOG_QUEUE_END:
                    break
                yield json.dumps(item, default=str) + "\n"
        finally:
            await exec_fut

        err = outcome.get("error")
        if err is not None:
            err_record = {
                "debate_id": debate_id,
                "question": question,
                "status": "failed",
                "round": 1,
                "messages": [],
                "final_answer": f"Debate execution failed: {err}",
                "agreement_score": 0.0,
                "quorum_met": False,
                "failed_nodes": failed_nodes,
                "created_at": created_at,
                "participants": [],
            }
            debates[debate_id] = err_record
            yield json.dumps({"event": "error", "detail": str(err), "debate": err_record}) + "\n"
            return

        pipeline_result = outcome["result"]
        record = _finalize_debate_record(
            debate_id=debate_id,
            created_at=created_at,
            question=question,
            pipeline_result=pipeline_result,
            simulate_failure=bool(payload.simulate_failure),
            failed_node=payload.failed_node,
        )
        debates[debate_id] = record
        yield json.dumps({"event": "result", "debate": record}) + "\n"

    return StreamingResponse(ndjson_body(), media_type="application/x-ndjson")


@app.get("/debates", response_model=DebatesListResponse)
def list_debates():
    rows = sorted(debates.values(), key=lambda d: str(d.get("created_at") or ""), reverse=True)
    summaries = [
        DebateSummary(
            debate_id=str(d["debate_id"]),
            question=str(d.get("question", "")),
            status=str(d.get("status", "")),
            round=int(d.get("round", 1)),
            created_at=str(d.get("created_at", "")),
        )
        for d in rows
    ]
    return DebatesListResponse(debates=summaries)


@app.get("/debate/{debate_id}", response_model=DebateResponse)
def get_debate(debate_id: str):
    debate = debates.get(debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found.")
    return debate