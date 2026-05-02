from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from arguenet.kafka_main import main as run_arguenet_main

app = FastAPI(title="ArgueNet Orchestrator", version="0.2.0")

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


# ----------------------------
# Request / Response Models
# ----------------------------
class DebateRequest(BaseModel):
    question: str
    simulate_failure: Optional[bool] = False
    failed_node: Optional[str] = None  # advocate | critic | moderator


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


# ----------------------------
# Debate runner
# ----------------------------
def execute_debate(question: str, simulate_failure: bool = False, failed_node: Optional[str] = None) -> dict:
    debate_id = str(uuid4())
    created_at = datetime.utcnow().isoformat()
    round_num = 1
    failed_nodes: List[str] = []
    if simulate_failure and failed_node in ROLE_ORDER:
        failed_nodes.append(failed_node)

    try:
        pipeline_result = asyncio.run(run_arguenet_main(question))
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
        }

    messages = _build_messages(pipeline_result, failed_nodes, round_num)
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
    debate_record = {
        "debate_id": debate_id,
        "question": question,
        "status": status,
        "round": round_num,
        "messages": messages,
        "final_answer": final_answer,
        "agreement_score": agreement_score,
        "quorum_met": quorum_met,
        "failed_nodes": failed_nodes,
        "created_at": created_at
    }

    debates[debate_id] = debate_record
    return debate_record


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "orchestrator"}


@app.post("/debate", response_model=DebateResponse)
def create_debate(payload: DebateRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = execute_debate(
        question=question,
        simulate_failure=payload.simulate_failure,
        failed_node=payload.failed_node
    )
    return result


@app.get("/debate/{debate_id}", response_model=DebateResponse)
def get_debate(debate_id: str):
    debate = debates.get(debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found.")
    return debate