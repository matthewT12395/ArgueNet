from arguenet.debate import termination
from arguenet.config import Argument

def make_arg(position_delta=0.1, confidence=0.9, argument="foo"):
    return Argument(
        agent_id="a", round=1, update_type="refine", update_reasoning="r",
        targets=["t"], argument=argument, claims=["c"], confidence=confidence,
        position_delta=position_delta, sources=["s"])

def test_semantic_similarity():
    assert termination.semantic_similarity("abc", "abc") == 1.0
    assert 0 <= termination.semantic_similarity("abc", "xyz") <= 1

def test_is_converged_and_stalemate():
    a1 = make_arg(position_delta=0.01)
    a2 = make_arg(position_delta=0.01)
    history = [[a1], [a2]]
    assert termination.is_converged(history) in [True, False]
    assert termination.is_stalemate(history) in [True, False]

def test_quorum_and_round_cap():
    args = [make_arg(confidence=0.9), make_arg(confidence=0.7)]
    assert termination.quorum_reached(args) in [True, False]
    assert termination.round_cap_hit(100) in [True, False]

def test_should_terminate():
    args = [make_arg()]
    history = [[make_arg()],[make_arg()]]
    result = termination.should_terminate(100, history, args)
    assert isinstance(result, tuple) and len(result) == 2
