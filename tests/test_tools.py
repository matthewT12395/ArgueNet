from arguenet.tools import search, wiki, registry, scraper, reddit
import os

def test_env_true():
    os.environ["TEST_BOOL"] = "true"
    assert search._env_true("TEST_BOOL")
    os.environ["TEST_BOOL"] = "0"
    assert not search._env_true("TEST_BOOL")

def test_build_tools_handles_disable():
    os.environ["ARGUENET_DISABLE_TOOLS"] = "1"
    assert search.build_tools("agent", ["news"]) == []
    os.environ["ARGUENET_DISABLE_TOOLS"] = "0"

def test_registry_claim_and_set():
    reg = registry.RoundSourceRegistry(round_num=1)
    assert reg.claim("foo")
    assert not reg.claim("foo")
    registry.set_registry(reg)
    assert registry.get_registry() is reg
    registry.set_registry(None)
    assert registry.get_registry() is None

def test_search_wiki_handles_import():
    assert isinstance(wiki.search_wiki.run("Python"), str)

def test_scrape_article_handles_import():
    assert isinstance(scraper.scrape_article.run("https://example.com"), str)

def test_search_reddit_handles_import():
    assert isinstance(reddit.search_reddit.run("Python"), list)
