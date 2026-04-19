from __future__ import annotations

from langchain_core.tools import tool

try:
    from .registry import get_registry
except ImportError:  # pragma: no cover
    from tools.registry import get_registry


@tool
def search_wiki(query: str) -> str:
    """Fetch Wikipedia summary for a topic."""
    reg = get_registry()
    if reg and not reg.claim(f"wiki:{query}"):
        return ""
    try:
        import wikipedia
    except ImportError:
        return ""
    try:
        return wikipedia.summary(query, sentences=3)
    except Exception:
        return ""
