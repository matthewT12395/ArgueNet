from __future__ import annotations

import os
import time

import requests
from langchain_core.tools import tool

try:
    from .registry import get_registry
except ImportError:  # pragma: no cover
    from tools.registry import get_registry

_LAST_CALL: float = 0.0
_MIN_INTERVAL = 1.1  # seconds between requests to stay under rate limit


@tool
def search_reddit(query: str) -> list[dict]:
    """Search Reddit discussions relevant to the query using public JSON endpoints."""
    global _LAST_CALL
    reg = get_registry()
    if reg and not reg.claim(f"reddit:{query}"):
        return []
    # Rate-limit: ~1 req/sec
    elapsed = time.monotonic() - _LAST_CALL
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    user_agent = os.getenv("REDDIT_USER_AGENT", "arguenet/1.0")
    headers = {"User-Agent": user_agent}
    try:
        resp = requests.get(
            "https://www.reddit.com/search.json",
            params={"q": query, "sort": "relevance", "limit": 5},
            headers=headers,
            timeout=10,
        )
        _LAST_CALL = time.monotonic()
        resp.raise_for_status()
        posts = resp.json()["data"]["children"]
        return [
            {
                "title": p["data"]["title"],
                "url": p["data"]["url"],
                "body": p["data"].get("selftext", "")[:500],
                "score": p["data"]["score"],
                "subreddit": p["data"]["subreddit"],
            }
            for p in posts
        ]
    except Exception:
        return []
