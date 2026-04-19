from __future__ import annotations

import asyncio, json

try:
    from ..config import Argument, ModeratorScore
    from ..tools.registry import RoundSourceRegistry, set_registry
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore
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


def _normalize_argument_payload(payload: dict, *, agent_id: str, round_num: int, default_target: str) -> dict:
    out = dict(payload)
    out["agent_id"] = out.get("agent_id") or out.get("agent") or agent_id
    out["round"] = int(out.get("round") or round_num)
    out["update_type"] = str(out.get("update_type") or "refine")
    out["update_reasoning"] = str(out.get("update_reasoning") or out.get("update_rationale") or "Refined based on round feedback.")
    argument_text = out.get("argument") or out.get("claim") or "No argument provided."
    out["argument"] = str(argument_text)

    claims = out.get("claims", [])
    if isinstance(claims, list):
        norm_claims = []
        for item in claims:
            if isinstance(item, str):
                norm_claims.append(item)
            elif isinstance(item, dict):
                norm_claims.append(str(item.get("text") or item.get("claim") or item))
            else:
                norm_claims.append(str(item))
        out["claims"] = norm_claims
    else:
        out["claims"] = [str(claims)]

    sources = out.get("sources", [])
    if isinstance(sources, list):
        norm_sources = []
        for item in sources:
            if isinstance(item, str):
                norm_sources.append(item)
            elif isinstance(item, dict):
                norm_sources.append(str(item.get("url") or item.get("description") or item.get("id") or item))
            else:
                norm_sources.append(str(item))
        out["sources"] = norm_sources
    else:
        out["sources"] = [str(sources)]

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


def _prompt(kind: str, question: str, round_num: int, history: list[Argument], scores: list[ModeratorScore], payload: list[Argument] | None = None) -> str:
    return _dump({"kind": kind, "question": question, "round": round_num, "history": history, "scores": scores, "arguments": payload or []})


async def run_round(round_num: int, question: str, agents: dict[str, object], history: list[Argument], scores: list[ModeratorScore]) -> list[Argument]:
    set_registry(RoundSourceRegistry(round_num))
    names = [n for n in agents if n != "moderator"]
    argue = await asyncio.gather(*[
        _invoke(
            agents[n],
            _prompt("argue", question, round_num, history, scores),
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
            _prompt("rebut", question, round_num, history, scored, argue),
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
