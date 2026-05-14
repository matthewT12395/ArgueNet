import pytest
from arguenet.debate import round as debate_round

def test_dump_and_json_payload():
    data = {"foo": "bar"}
    dumped = debate_round._dump(data)
    assert isinstance(dumped, str)
    assert debate_round._json_payload('{"foo": "bar"}') == data
    with pytest.raises(ValueError):
        debate_round._json_payload('no json here')

def test_extract_text_variants():
    assert debate_round._extract_text("hello") == "hello"
    assert debate_round._extract_text({"output": "hi"}) == "hi"
    # The function returns str(message) if not a list, so dict becomes its string representation
    assert debate_round._extract_text({"messages": [{"content": "yo"}]}) == "{'content': 'yo'}"
    class Dummy:
        content = "dummy"
    assert debate_round._extract_text(Dummy()) == "dummy"

def test_coerce_text():
    assert debate_round._coerce_text(None) == ""
    assert debate_round._coerce_text("abc") == "abc"
    assert debate_round._coerce_text({"argument": "x"}) == "x"
    assert debate_round._coerce_text([{"argument": "y"}]) == "y"
    assert debate_round._coerce_text({}) == "{}"
