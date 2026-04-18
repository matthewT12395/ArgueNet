from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from uuid import uuid4
from datetime import datetime
import random

app = FastAPI(title="ArgueNet Orchestrator", version="0.1.0")

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


# ----------------------------
# Mock agent services
# Replace these later with real HTTP calls
# ----------------------------
def mock_advocate(question: str, round_num: int) -> dict:
    templates = [
        "AI can improve efficiency, consistency, and scalability in handling this issue.",
        "A strong case can be made in favor of this because it saves time and supports better decision-making.",
        "The advantages include speed, automation, and broader access to useful analysis."
    ]
    return {
        "sender": "advocate",
        "position": "support",
        "content": random.choice(templates) + f" Question: {question}",
        "confidence": round(random.uniform(0.72, 0.90), 2),
        "round": round_num,
        "timestamp": datetime.utcnow().isoformat()
    }


def mock_critic(question: str, round_num: int) -> dict:
    templates = [
        "There are risks involving bias, oversimplification, and lack of context.",
        "A strong objection is that this can reduce fairness, transparency, or human judgment.",
        "The downside is that automation may ignore nuance and create unreliable outcomes."
    ]
    return {
        "sender": "critic",
        "position": "oppose",
        "content": random.choice(templates) + f" Question: {question}",
        "confidence": round(random.uniform(0.68, 0.88), 2),
        "round": round_num,
        "timestamp": datetime.utcnow().isoformat()
    }


def mock_moderator(question: str, prior_messages: List[dict], round_num: int) -> dict:
    advocate_msg = next((m for m in prior_messages if m["sender"] == "advocate"), None)
    critic_msg = next((m for m in prior_messages if m["sender"] == "critic"), None)

    advocate_summary = advocate_msg["content"] if advocate_msg else "No advocate response."
    critic_summary = critic_msg["content"] if critic_msg else "No critic response."

    return {
        "sender": "moderator",
        "position": "neutral",
        "content": (
            "The advocate emphasizes benefits such as efficiency and scale, while the critic "
            "emphasizes risks such as bias and lack of nuance. A balanced conclusion may combine "
            "automation with human oversight.\n\n"
            f"Advocate: {advocate_summary}\n"
            f"Critic: {critic_summary}"
        ),
        "confidence": 0.82,
        "round": round_num,
        "timestamp": datetime.utcnow().isoformat()
    }


# ----------------------------
# Simple consensus logic
# ----------------------------
def run_consensus(question: str, messages: List[dict], failed_nodes: List[str]) -> dict:
    responses_received = len(messages)
    quorum_met = responses_received >= 2

    if not quorum_met:
        return {
            "status": "failed",
            "final_answer": "Consensus could not be reached because quorum was not met.",
            "agreement_score": 0.0,
            "quorum_met": False,
            "failed_nodes": failed_nodes
        }

    moderator_msg = next((m for m in messages if m["sender"] == "moderator"), None)
    advocate_msg = next((m for m in messages if m["sender"] == "advocate"), None)
    critic_msg = next((m for m in messages if m["sender"] == "critic"), None)

    if moderator_msg:
        final_answer = (
            "Final decision: Use a balanced approach. "
            "The system recommends considering both benefits and risks, with human oversight where needed."
        )
        agreement_score = 0.67
    elif advocate_msg and critic_msg:
        final_answer = (
            "Final decision: The debate contains both support and opposition, "
            "so the result remains contested but valid viewpoints were collected."
        )
        agreement_score = 0.50
    elif advocate_msg:
        final_answer = "Final decision: The available response supports proceeding with the proposed approach."
        agreement_score = 0.60
    else:
        final_answer = "Final decision: The available response raises concerns and suggests caution."
        agreement_score = 0.60

    return {
        "status": "completed",
        "final_answer": final_answer,
        "agreement_score": agreement_score,
        "quorum_met": True,
        "failed_nodes": failed_nodes
    }


# ----------------------------
# Debate runner
# ----------------------------
def execute_debate(question: str, simulate_failure: bool = False, failed_node: Optional[str] = None) -> dict:
    debate_id = str(uuid4())
    created_at = datetime.utcnow().isoformat()
    round_num = 1
    messages = []
    failed_nodes = []

    services = ["advocate", "critic", "moderator"]

    if simulate_failure and failed_node in services:
        failed_nodes.append(failed_node)

    # Step 1: advocate
    if "advocate" not in failed_nodes:
        advocate_response = mock_advocate(question, round_num)
        messages.append(advocate_response)

    # Step 2: critic
    if "critic" not in failed_nodes:
        critic_response = mock_critic(question, round_num)
        messages.append(critic_response)

    # Step 3: moderator
    if "moderator" not in failed_nodes:
        moderator_response = mock_moderator(question, messages, round_num)
        messages.append(moderator_response)

    # Step 4: consensus
    consensus = run_consensus(question, messages, failed_nodes)

    debate_record = {
        "debate_id": debate_id,
        "question": question,
        "status": consensus["status"],
        "round": round_num,
        "messages": messages,
        "final_answer": consensus["final_answer"],
        "agreement_score": consensus["agreement_score"],
        "quorum_met": consensus["quorum_met"],
        "failed_nodes": consensus["failed_nodes"],
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