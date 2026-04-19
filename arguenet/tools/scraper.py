from __future__ import annotations

from langchain_core.tools import tool

try:
    from .registry import get_registry
except ImportError:  # pragma: no cover
    from tools.registry import get_registry


@tool
def scrape_article(url: str) -> str:
    """Scrape full article text from a news URL."""
    reg = get_registry()
    if reg and not reg.claim(f"scraper:{url}"):
        return ""
    try:
        import trafilatura
    except ImportError:
        return ""
    downloaded = trafilatura.fetch_url(url)
    return trafilatura.extract(downloaded) or ""
