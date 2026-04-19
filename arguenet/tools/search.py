from __future__ import annotations

import os

from langchain_core.tools import tool

try:
    from .registry import get_registry
    from .reddit import search_reddit
    from .scraper import scrape_article
    from .wiki import search_wiki
except ImportError:  # pragma: no cover
    from tools.registry import get_registry
    from tools.reddit import search_reddit
    from tools.scraper import scrape_article
    from tools.wiki import search_wiki

NEWS_DOMAINS = ["reuters.com", "apnews.com", "bbc.com", "nytimes.com"]


@tool
def search_news(query: str) -> list[dict]:
    """Search news articles relevant to the query."""
    reg = get_registry()
    if reg and not reg.claim(f"news:{query}"):
        return []
    try:
        from tavily import TavilyClient
    except ImportError:
        return []
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return []
    try:
        client = TavilyClient(api_key=key)
        return client.search(query, include_domains=NEWS_DOMAINS).get("results", [])
    except Exception:
        return []


def build_tools(agent_id: str, source_types: list[str]) -> list:
    all_tools = {"news": search_news, "reddit": search_reddit, "wiki": search_wiki, "scraper": scrape_article}
    enabled = []
    for source in source_types:
        if source not in all_tools:
            continue
        if source == "news" and not os.getenv("TAVILY_API_KEY"):
            continue
        if source == "reddit" and False:  # public JSON endpoint — no credentials needed
            continue
        enabled.append(all_tools[source])
    return enabled
