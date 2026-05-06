from __future__ import annotations

import importlib
import os
import re
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

try:
    from ..config import AGENT_TEMPS
    from ..tools.search import build_tools
    from . import advocate, devils_advocate, empiricist, moderator, skeptic, scorer
except ImportError:  # pragma: no cover
    from config import AGENT_TEMPS
    from tools.search import build_tools
    from agents import advocate, devils_advocate, empiricist, moderator, skeptic, scorer

AGENT_MODULES = {
    "skeptic": skeptic,
    "advocate": advocate,
    "devils_advocate": devils_advocate,
    "empiricist": empiricist,
    "moderator": moderator,
    "scorer": scorer,
}

EXAMPLE_AGENT_LIBRARY: dict[str, dict[str, Any]] = {
    "policy_hawk": {
        "label": "Policy Hawk",
        "source_types": ["news", "wiki"],
        "system_prompt": (
            "You are Policy Hawk, focused on policy design and public outcomes.\n"
            "Debate by emphasizing incentives, implementation constraints, and second-order effects.\n"
            "Ground claims in credible evidence where possible.\n"
            "Return JSON only matching the argument schema."
        ),
    },
    "startup_founder": {
        "label": "Startup Founder",
        "source_types": ["news", "reddit", "wiki"],
        "system_prompt": (
            "You are Startup Founder, focused on execution speed, product outcomes, and talent leverage.\n"
            "Debate with pragmatic trade-offs, clear assumptions, and measurable impacts.\n"
            "Ground claims in evidence where possible.\n"
            "Return JSON only matching the argument schema."
        ),
    },
}


def _build_personal_system_prompt(profile: dict[str, str]) -> str:
    name = (profile.get("name") or "PersonalAgent").strip()
    background = (profile.get("background") or "No background provided.").strip()
    hobbies = (profile.get("hobbies") or "No hobbies provided.").strip()
    interests = (profile.get("interests") or "").strip()
    beliefs = (profile.get("beliefs") or "No beliefs provided.").strip()
    comm_style = (profile.get("communication_style") or "").strip()
    lines = [
        "You are a personalized participant in a structured debate.",
        f"Identity: {name}",
        f"Background: {background}",
        f"Hobbies: {hobbies}",
    ]
    if interests:
        lines.append(f"Interests: {interests}")
    if comm_style:
        lines.append(f"Communication style: {comm_style}")
    lines.append(f"Beliefs: {beliefs}")
    lines += [
        "Behavior requirements:",
        "- Respond as this person would, while staying respectful and analytical",
        "- Incorporate at least one concrete, evidence-backed point when possible",
        "- Acknowledge uncertainty where appropriate",
        "- Return JSON only matching the argument schema",
    ]
    return "\n".join(lines)


def _safe_agent_id(raw: str, *, prefix: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]+", "_", raw.strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned:
        cleaned = fallback
    return f"{prefix}{cleaned}"


def _resolve_agent_executor() -> Any:
    agents_mod = importlib.import_module("langchain.agents")
    cls = getattr(agents_mod, "AgentExecutor", None)
    if cls is not None:
        return cls
    legacy_mod = importlib.import_module("langchain.agents.agent")
    cls = getattr(legacy_mod, "AgentExecutor", None)
    if cls is None:
        raise ImportError("AgentExecutor not found in installed langchain version")
    return cls


def _build_executor(llm: Any, tools: list[Any], system_prompt: str) -> Any:
    agents_mod = importlib.import_module("langchain.agents")
    create_graph_agent = getattr(agents_mod, "create_agent", None)
    if create_graph_agent is not None:
        return create_graph_agent(
            model=llm,
            tools=tools,
            system_prompt=system_prompt,
            debug=False,
            name="arguenet-agent",
        )

    create_tool = getattr(agents_mod, "create_tool_calling_agent", None)
    if create_tool is not None:
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ])
        agent = create_tool(llm, tools, prompt)
        agent_executor_cls = _resolve_agent_executor()
        return agent_executor_cls(agent=agent, tools=tools, verbose=True)

    initialize_agent = getattr(agents_mod, "initialize_agent", None)
    agent_type_enum = getattr(agents_mod, "AgentType", None)
    if initialize_agent is None or agent_type_enum is None:
        raise ImportError("No supported LangChain agent builder found")

    fallback_type = getattr(agent_type_enum, "STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION", None)
    if fallback_type is None:
        fallback_type = getattr(agent_type_enum, "CHAT_ZERO_SHOT_REACT_DESCRIPTION", None)
    if fallback_type is None:
        fallback_type = getattr(agent_type_enum, "ZERO_SHOT_REACT_DESCRIPTION")

    return initialize_agent(
        tools=tools,
        llm=llm,
        agent=fallback_type,
        verbose=True,
        agent_kwargs={"system_message": system_prompt},
    )


def build_agent(agent_id: str, system_prompt: str, source_types: list[str]) -> Any:
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required to run ArgueNet agents")

    llm = ChatOpenAI(
        model=os.getenv("ARGUENET_MODEL", "openai/gpt-4o-mini"),
        temperature=AGENT_TEMPS.get(agent_id, 0.65),
        api_key=api_key,
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    )
    tools = build_tools(agent_id, source_types)
    return _build_executor(llm, tools, system_prompt)


def build_agents(
    personal_profile: dict[str, str] | None = None,
    personal_profiles: list[dict[str, str]] | None = None,
    example_agent_ids: list[str] | None = None,
) -> dict[str, Any]:
    agents = {name: build_agent(name, mod.SYSTEM_PROMPT, mod.SOURCE_TYPES) for name, mod in AGENT_MODULES.items()}

    # Backward-compatible single profile support.
    if personal_profile:
        personal_agent_id = _safe_agent_id(personal_profile.get("name") or "personal_agent", prefix="friend_", fallback="personal_agent")
        agents[personal_agent_id] = build_agent(
            personal_agent_id,
            _build_personal_system_prompt(personal_profile),
            ["news", "wiki", "reddit"],
        )

    # New multi-profile support for additional friend agents.
    for idx, profile in enumerate(personal_profiles or [], start=1):
        name = profile.get("name") or f"friend_{idx}"
        base_id = _safe_agent_id(name, prefix="friend_", fallback=f"friend_{idx}")
        agent_id = base_id
        suffix = 2
        while agent_id in agents:
            agent_id = f"{base_id}_{suffix}"
            suffix += 1
        agents[agent_id] = build_agent(
            agent_id,
            _build_personal_system_prompt(profile),
            ["news", "wiki", "reddit"],
        )

    # Runtime-selected built-in example agents.
    for example_id in example_agent_ids or []:
        spec = EXAMPLE_AGENT_LIBRARY.get(example_id)
        if not spec:
            continue
        agent_id = f"example_{example_id}"
        if agent_id in agents:
            continue
        agents[agent_id] = build_agent(
            agent_id,
            spec["system_prompt"],
            list(spec["source_types"]),
        )

    return agents
