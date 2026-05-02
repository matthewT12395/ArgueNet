from __future__ import annotations

import importlib
import os
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

try:
    from ..config import AGENT_TEMPS
    from ..tools.search import build_tools
    from . import advocate, devils_advocate, empiricist, moderator, skeptic
except ImportError:  # pragma: no cover
    from config import AGENT_TEMPS
    from tools.search import build_tools
    from agents import advocate, devils_advocate, empiricist, moderator, skeptic

AGENT_MODULES = {
    "skeptic": skeptic,
    "advocate": advocate,
    "devils_advocate": devils_advocate,
    "empiricist": empiricist,
    "moderator": moderator,
}


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
        model=os.getenv("ARGUENET_MODEL", "meta-llama/llama-3.1-8b-instruct:free"),
        temperature=AGENT_TEMPS[agent_id],
        api_key=api_key,
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    )
    tools = build_tools(agent_id, source_types)
    return _build_executor(llm, tools, system_prompt)


def build_agents() -> dict[str, Any]:
    return {name: build_agent(name, mod.SYSTEM_PROMPT, mod.SOURCE_TYPES) for name, mod in AGENT_MODULES.items()}
