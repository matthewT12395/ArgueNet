from __future__ import annotations

import asyncio, json

try:
    from ..config import Argument, ModeratorScore, RoundScore
    from ..tools.registry import RoundSourceRegistry, set_registry
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore, RoundScore
    from tools.registry import RoundSourceRegistry, set_registry


def _dump(value):
    return json.dumps(value, default=lambda o: o.model_dump())


def _json_payload(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    first_obj = text.find("{")
    first_arr = text.find("[")
    starts = [i for i in [first_obj, first_arr] if i >= 0]
    if not starts:
        raise ValueError("No JSON found in model output")
    start = min(starts)
    snippet = text[start:]
    for end in range(len(snippet), 0, -1):
        try:
            return json.loads(snippet[:end])
        except Exception:
            continue
    raise ValueError("Could not parse JSON payload from model output")


def _extract_text(result) -> str:
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        if "output" in result:
            return result["output"]
        if "messages" in result and result["messages"]:
            message = result["messages"][-1]
            content = getattr(message, "content", message)
            if isinstance(content, list):
                joined = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        joined.append(block.get("text", ""))
                    else:
                        joined.append(str(block))
                return "\n".join(joined)
            return str(content)
    content = getattr(result, "content", None)
    if content is not None:
        return str(content)
    return str(result)


def _parse(result, schema):
    return schema(**_json_payload(_extract_text(result)))


def _coerce_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("argument", "claim", "steelman", "text", "content", "summary", "thesis"):
            if key in value and str(value.get(key, "")).strip():
                return str(value[key]).strip()
        return str(value).strip()
    if isinstance(value, list):
        for item in value:
            text = _coerce_text(item)
            if text:
                return text
        return ""
    return str(value).strip()


def _normalize_argument_payload(payload: dict, *, agent_id: str, round_num: int, default_target: str) -> dict:
    out = dict(payload)
    out["agent_id"] = out.get("agent_id") or out.get("agent") or agent_id
    out["round"] = int(out.get("round") or round_num)
    out["update_type"] = str(out.get("update_type") or "refine")
    out["update_reasoning"] = str(out.get("update_reasoning") or out.get("update_rationale") or "Refined based on round feedback.")

    argument_text = _coerce_text(out.get("argument"))
    if not argument_text:
        argument_text = _coerce_text(out.get("claim"))
    if not argument_text and isinstance(out.get("arguments"), list):
        argument_text = _coerce_text(out.get("arguments"))
    if not argument_text:
        argument_text = "No argument provided."
    out["argument"] = argument_text

    claims = out.get("claims")
    if claims is None:
        claims = out.get("key_claims")
    if claims is None:
        claims = out.get("arguments")
    if claims is None:
        claims = out.get("evidence")

    if isinstance(claims, list):
        norm_claims = []
        for item in claims:
            text = _coerce_text(item)
            if text:
                norm_claims.append(text)
        out["claims"] = norm_claims
    elif isinstance(claims, dict):
        text = _coerce_text(claims)
        out["claims"] = [text] if text else []
    else:
        text = _coerce_text(claims)
        out["claims"] = [text] if text else []

    if not out["claims"] and argument_text and argument_text != "No argument provided.":
        out["claims"] = [argument_text[:280]]

    sources = out.get("sources")
    if sources is None and isinstance(out.get("evidence"), dict):
        ev = out.get("evidence")
        sources = [ev.get("source") or ev.get("url") or ev.get("citation")]
    if sources is None:
        sources = []

    if isinstance(sources, list):
        norm_sources = []
        for item in sources:
            if isinstance(item, str):
                if item.strip():
                    norm_sources.append(item.strip())
            elif isinstance(item, dict):
                val = item.get("url") or item.get("source") or item.get("description") or item.get("id")
                if val:
                    norm_sources.append(str(val).strip())
            else:
                text = _coerce_text(item)
                if text:
                    norm_sources.append(text)
        out["sources"] = norm_sources
    else:
        text = _coerce_text(sources)
        out["sources"] = [text] if text else []

    out["confidence"] = float(out.get("confidence", 0.6))
    out["position_delta"] = float(out.get("position_delta", 0.05))

    targets = out.get("targets", [])
    if not isinstance(targets, list):
        targets = [str(targets)]
    targets = [str(t) for t in targets if str(t).strip()]
    out["targets"] = targets or [default_target]
    return out


def _normalize_score_payload(item: dict, *, round_num: int) -> dict:
    out = dict(item)
    out["agent_id"] = str(out.get("agent_id") or out.get("agent") or "unknown")
    out["round"] = int(out.get("round") or round_num)
    out["relevance"] = float(out.get("relevance", 0.5))
    out["evidence_quality"] = float(out.get("evidence_quality", 0.5))
    out["novelty"] = float(out.get("novelty", 0.5))
    out["rebuttal_force"] = float(out.get("rebuttal_force", 0.5))
    out["weighted_score"] = float(out.get("weighted_score", out.get("overall", 0.5)))
    out["weakest_dimension"] = str(out.get("weakest_dimension", "evidence_quality"))
    must = out.get("you_must_respond_to")
    if must is None:
        must = out.get("feedback", "")
    if isinstance(must, list):
        out["you_must_respond_to"] = [str(x) for x in must]
    else:
        out["you_must_respond_to"] = [str(must)] if str(must).strip() else []
    return out


def _argument_from_text(text: str, *, agent_id: str, round_num: int, default_target: str) -> dict:
    cleaned = " ".join(text.strip().split())
    if not cleaned:
        cleaned = "No argument provided."
    return {
        "agent_id": agent_id,
        "round": round_num,
        "update_type": "refine",
        "update_reasoning": "Converted from plain-text model output.",
        "targets": [default_target],
        "argument": cleaned,
        "claims": [cleaned[:280]],
        "confidence": 0.55,
        "position_delta": 0.03,
        "sources": [],
    }


async def _ainvoke_agent(agent, prompt: str):
    try:
        return await agent.ainvoke({"messages": [{"role": "user", "content": prompt}]})
    except Exception:
        return await agent.ainvoke({"input": prompt})


async def _invoke(agent, prompt: str, schema, *, retry_msg: str, agent_id: str, round_num: int, default_target: str) -> object:
    schema_msg = (
        "Return ONLY a JSON object matching this schema keys exactly: "
        "agent_id, round, update_type, update_reasoning, targets, argument, claims, confidence, position_delta, sources."
    )
    for _ in range(3):
        raw = None
        try:
            raw = await _ainvoke_agent(agent, prompt)
            payload = _json_payload(_extract_text(raw))
            if schema.__name__ == "Argument" and isinstance(payload, dict):
                payload = _normalize_argument_payload(
                    payload,
                    agent_id=agent_id,
                    round_num=round_num,
                    default_target=default_target,
                )
            parsed = schema(**payload)
        except Exception as exc:
            if raw is not None and schema.__name__ == "Argument":
                try:
                    text_payload = _argument_from_text(
                        _extract_text(raw),
                        agent_id=agent_id,
                        round_num=round_num,
                        default_target=default_target,
                    )
                    return schema(**text_payload)
                except Exception:
                    pass
            prompt += "\n" + schema_msg + f" Validation error: {exc}"
            continue
        if getattr(parsed, "targets", [1]):
            return parsed
        prompt += "\n" + retry_msg
    return schema(
        agent_id=agent_id,
        round=round_num,
        update_type="refine",
        update_reasoning="Fallback generated after schema retries failed.",
        targets=[default_target],
        argument="Fallback argument generated to satisfy debate schema.",
        claims=["Fallback claim"],
        confidence=0.5,
        position_delta=0.01,
        sources=[],
    )


def _prompt(kind: str, question: str, round_num: int, history: list[Argument], scores: list[ModeratorScore], payload: list[Argument] | None = None, feedback: dict[str, str] | None = None) -> str:
    return _dump({"kind": kind, "question": question, "round": round_num, "history": history, "scores": scores, "arguments": payload or [], "feedback": feedback or {}})


async def run_round(round_num: int, question: str, agents: dict[str, object], history: list[Argument], scores: list[ModeratorScore], feedback: dict[str, str] | None = None) -> list[Argument]:
    set_registry(RoundSourceRegistry(round_num))
    names = [n for n in agents if n != "moderator" and n != "scorer"]
    
    # Use feedback if provided, otherwise empty dict
    agent_feedback = feedback or {}
    
    argue = await asyncio.gather(*[
        _invoke(
            agents[n],
            _prompt("argue", question, round_num, history, scores, feedback=agent_feedback),
            Argument,
            retry_msg="Include at least one targets entry.",
            agent_id=n,
            round_num=round_num,
            default_target=f"shared.round{round_num}.claim1",
        )
        for n in names
    ])
    scored = await score_round(round_num, question, agents["moderator"], argue, history)
    rebut = await asyncio.gather(*[
        _invoke(
            agents[n],
            _prompt("rebut", question, round_num, history, scored, argue, feedback=agent_feedback),
            Argument,
            retry_msg="Include at least one targets entry.",
            agent_id=n,
            round_num=round_num,
            default_target=f"shared.round{round_num}.claim1",
        )
        for n in names
    ])
    return list(rebut)


async def score_round(round_num: int, question: str, moderator, arguments: list[Argument], history: list[Argument]) -> list[ModeratorScore]:
    prompt = _prompt("score", question, round_num, history, [], arguments)
    schema_msg = (
        "Return ONLY JSON as a list of objects with keys: "
        "agent_id, round, relevance, evidence_quality, novelty, rebuttal_force, weighted_score, weakest_dimension, you_must_respond_to."
    )
    for _ in range(3):
        try:
            raw = await _ainvoke_agent(moderator, prompt)
            data = _json_payload(_extract_text(raw))
            if isinstance(data, dict) and "agent_scores" in data:
                data = data["agent_scores"]
            if isinstance(data, dict):
                data = [data]
            normalized = [_normalize_score_payload(item, round_num=round_num) for item in data]
            return [ModeratorScore(**item) for item in normalized]
        except Exception as exc:
            prompt += "\n" + schema_msg + f" Validation error: {exc}"
    return [
        ModeratorScore(
            agent_id=arg.agent_id,
            round=round_num,
            relevance=0.5,
            evidence_quality=0.5,
            novelty=0.5,
            rebuttal_force=0.5,
            weighted_score=0.5,
            weakest_dimension="evidence_quality",
            you_must_respond_to=["Provide stronger evidence next round."],
        )
        for arg in arguments
    ]


def _normalize_round_score_payload(payload: dict, *, round_num: int, arguments: list[Argument], moderator_scores: list[ModeratorScore]) -> dict:
    """Normalize scorer output to RoundScore schema."""
    out = dict(payload)
    out["round"] = int(out.get("round") or round_num)
    
    # Get all scores from scorer (should be 0-100)
    all_scores = out.get("all_scores") or {}
    if isinstance(all_scores, dict):
        all_scores = {str(k): float(v) for k, v in all_scores.items()}
    else:
        # Fallback to moderator scores if not provided
        all_scores = {s.agent_id: s.weighted_score for s in moderator_scores}
    out["all_scores"] = all_scores
    
    # Determine winner from scores
    winner = out.get("winner") or out.get("top_performer")
    winner_score = 0.0
    
    # If winner not explicitly provided, determine from scores
    if not winner:
        if all_scores:
            winner = max(all_scores, key=all_scores.get)
            winner_score = all_scores[winner]
    else:
        winner = str(winner)
        winner_score = all_scores.get(winner, 0.0)
    
    out["winner"] = winner
    out["winner_score"] = float(out.get("winner_score") or winner_score)
    
    # Get all arguments
    all_arguments = out.get("all_arguments") or {}
    if isinstance(all_arguments, dict):
        all_arguments = {str(k): str(v) for k, v in all_arguments.items()}
    else:
        all_arguments = {arg.agent_id: arg.argument for arg in arguments}
    out["all_arguments"] = all_arguments
    
    # Get fact checks
    fact_checks = out.get("fact_checks") or {}
    if isinstance(fact_checks, dict):
        out["fact_checks"] = {str(k): str(v) for k, v in fact_checks.items()}
    else:
        out["fact_checks"] = {}
    
    out["summary"] = str(out.get("summary") or "Round evaluation complete.")
    
    key_insights = out.get("key_insights", [])
    if isinstance(key_insights, list):
        out["key_insights"] = [str(x) for x in key_insights]
    else:
        out["key_insights"] = [str(key_insights)] if str(key_insights).strip() else []
    
    # Feedback for agents
    feedback = out.get("feedback_for_agents") or {}
    if isinstance(feedback, dict):
        out["feedback_for_agents"] = {str(k): str(v) for k, v in feedback.items()}
    else:
        # Generate default feedback if not provided
        out["feedback_for_agents"] = {arg.agent_id: "Continue improving." for arg in arguments}
    
    return out


async def run_scorer(round_num: int, question: str, scorer_agent, arguments: list[Argument], moderator_scores: list[ModeratorScore], history: list[Argument]) -> RoundScore:
    """Run the scorer agent to evaluate all participant agents with fact-checking."""
    # Create a comprehensive scoring prompt with arguments and sources
    arguments_summary = json.dumps([
        {
            "agent": arg.agent_id,
            "argument": arg.argument,
            "claims": arg.claims,
            "sources": arg.sources,
            "confidence": arg.confidence,
        }
        for arg in arguments
    ], indent=2)
    
    scores_summary = json.dumps([
        {
            "agent": score.agent_id,
            "relevance": score.relevance,
            "evidence_quality": score.evidence_quality,
            "novelty": score.novelty,
            "rebuttal_force": score.rebuttal_force,
            "weighted_score": score.weighted_score,
        }
        for score in moderator_scores
    ], indent=2)
    
    scorer_prompt = f"""
You are evaluating a debate round with RIGOROUS FACT-CHECKING.
Question: {question}
Round: {round_num}

Current arguments from this round:
{arguments_summary}

Moderator quality scores for these arguments:
{scores_summary}

Your task is to:
1. FACT-CHECK each agent's claims against their sources or your own knowledge
2. Score each agent numerically (0-100) on:
   - Factual Accuracy: How many facts are verifiable/true
   - Evidence Quality: How well sources support claims
   - Argument Strength: Logical coherence and persuasiveness
   - Source Credibility: How reliable are the sources cited
   - OVERALL SCORE = (Accuracy*0.3 + Evidence*0.25 + Strength*0.25 + Credibility*0.2)
3. Identify the winner (highest overall score)
4. Summarize key insights and any factual errors found
5. Provide specific, actionable feedback for EACH agent for their NEXT contribution

For each agent specifically note:
- Factual errors or unsupported claims
- Quality of evidence and sources
- Argument coherence
- Comparison to other agents
- Specific improvements needed

Return ONLY a JSON object matching this schema exactly:
{{
  "round": {round_num},
  "winner": "agent_name_with_highest_score",
  "winner_score": 0.0,
  "all_scores": {{"agent_name": 75.5, "agent_name2": 68.3}},
  "all_arguments": {{"agent_name": "their argument text"}},
  "fact_checks": {{"agent_name": "factual accuracy summary and any errors"}},
  "summary": "Overall summary of round with fact-checking results",
  "key_insights": ["insight1", "insight2"],
  "feedback_for_agents": {{"agent_name": "personalized feedback with fact-check results and improvement suggestions"}}
}}
"""
    
    schema_msg = (
        "Return ONLY a JSON object with keys: "
        "round, winner, winner_score, all_scores, all_arguments, fact_checks, summary, key_insights, feedback_for_agents. "
        "Ensure all_scores contains numerical scores (0-100) for every agent."
    )
    
    for _ in range(3):
        try:
            raw = await _ainvoke_agent(scorer_agent, scorer_prompt)
            payload = _json_payload(_extract_text(raw))
            
            # Normalize the payload
            normalized = _normalize_round_score_payload(
                payload,
                round_num=round_num,
                arguments=arguments,
                moderator_scores=moderator_scores,
            )
            
            return RoundScore(**normalized)
        except Exception as exc:
            scorer_prompt += "\n" + schema_msg + f" Validation error: {exc}"
    
    # Fallback RoundScore
    score_dict = {s.agent_id: s.weighted_score for s in moderator_scores}
    winner = max(score_dict, key=score_dict.get) if score_dict else "unknown"
    
    return RoundScore(
        round=round_num,
        winner=winner,
        winner_score=score_dict.get(winner, 0.0),
        all_scores=score_dict,
        all_arguments={arg.agent_id: arg.argument for arg in arguments},
        summary="Fallback scoring generated after schema retries failed.",
        key_insights=["Round completed successfully."],
        feedback_for_agents={arg.agent_id: "Continue building on your arguments." for arg in arguments},
    )
