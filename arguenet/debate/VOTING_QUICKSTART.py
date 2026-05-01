"""
VOTING ALGORITHM QUICK START GUIDE

The voting algorithm is now integrated into ArgueNet and will automatically
run whenever the system has updated keys (arguments, scores, etc.).


QUICK START
===========

1. AUTOMATIC VOTING (Recommended)
   ------
   Simply use build_consensus() as before - it now uses voting internally:
   
   from arguenet.debate.consensus import build_consensus
   
   result = build_consensus(arguments, scores, "convergence")
   print(f"Answer: {result['answer']}")
   print(f"Consensus Mode: {result['voting_mode']}")
   print(f"Strength: {result['consensus_strength']:.2%}")


2. MONITOR KEY UPDATES
   ------
   Use KeyUpdateManager to trigger voting on data changes:
   
   from arguenet.debate.key_updates import KeyUpdateManager
   
   manager = KeyUpdateManager()
   
   # Register callback (optional)
   def on_vote(result):
       print(f"Voted via {result.voting_mode.value}")
   
   manager.register_trigger("arguments", callback=on_vote)
   
   # Notify on updates
   manager.notify_update("arguments", new_arguments)
   manager.notify_update("scores", new_scores)
   
   # Execute voting when ready
   result = manager.check_and_execute_voting(arguments, scores)


3. FORCE SPECIFIC VOTING MODE
   ------
   For testing or specific scenarios:
   
   result = build_consensus(
       arguments, scores, "convergence",
       voting_mode="weighted_consensus"  # or "unanimity", "supermajority", etc.
   )


VOTING MODES
============

UNANIMITY
  Threshold: All 4 agents aligned within 0.1 confidence
  Use: High-stakes decisions requiring absolute agreement
  Strength: 0.95

SUPERMAJORITY
  Threshold: 3/4 agents aligned within 0.15 confidence
  Use: Strong consensus despite some disagreement
  Strength: 0.75

MAJORITY
  Threshold: 3+ agents with confidence >= 0.4
  Use: Working consensus for diverse debates
  Strength: 0.5-0.75

WEIGHTED_CONSENSUS
  Threshold: Moderator scores weight agent votes
  Use: Complex tradeoffs, moderator expertise matters
  Strength: Variable (usually 0.3-0.8)

CONFIDENCE_WEIGHTED
  Threshold: 60% agent confidence + 40% moderator score
  Use: Balanced approach emphasizing agent confidence
  Strength: Variable

SIMILARITY_CLUSTER
  Threshold: Largest group of similarly-positioned agents
  Use: Identifying fault lines and debate camps
  Strength: Cluster size / total agents


AUTOMATIC MODE SELECTION
=========================

The system automatically picks the best voting mode:

Low alignment (std < 0.08)         → UNANIMITY
Medium alignment (std < 0.15)      → SUPERMAJORITY
Medium-high alignment (std < 0.25) → MAJORITY
High alignment with scores         → WEIGHTED_CONSENSUS
High alignment, no scores          → CONFIDENCE_WEIGHTED


KEY UPDATES THAT TRIGGER VOTING
================================

The system automatically triggers voting when these keys are updated:

"arguments"       - New arguments from agents
"scores"          - Updated moderator scores
"confidence"      - Agent confidence changes
"moderator_update" - Explicit moderator update

Example:
  manager.notify_update("arguments", current_arguments, source="agents")
  # Voting automatically scheduled via debounce


OUTPUT STRUCTURE
================

build_consensus() now returns:

{
    "answer": "The consensus position",
    "confidence": 0.82,                    # Consensus confidence
    "termination_reason": "convergence",
    "reasoning_trace": [...],              # All arguments
    "dissent_log": [...],                  # Agents who disagreed
    
    # NEW: Voting transparency
    "voting_mode": "weighted_consensus",   # Which mode was used
    "voting_breakdown": {...},             # Detailed voting stats
    "agent_alignment": {...},              # Per-agent weights
    "dissent_reasons": [...],              # Why agents disagreed
    "consensus_strength": 0.35,            # Dominance of winner
    "unanimity_achieved": false,
    "supermajority_achieved": true,
}


FILES ADDED
===========

arguenet/debate/voting.py
  - VotingAlgorithm class with all voting modes
  - AgentVote and VotingResult dataclasses
  - Auto-selection of best voting mode

arguenet/debate/key_updates.py
  - KeyUpdateManager for automatic triggers
  - Update history tracking
  - Callback registration

arguenet/debate/voting_integration_example.py
  - Three complete examples of integration
  - Shows auto, forced, and early-termination patterns


INTEGRATION CHECKLIST
=====================

To integrate into your main loop:

1. ✓ Update consensus.py imports (DONE)
2. ✓ Update main.py imports if needed
3. Choose integration pattern (see examples)
4. Test with your data
5. Monitor voting_breakdown for insights


TESTING WITHOUT API CALLS
==========================

You can test the voting algorithm locally:

from arguenet.config import Argument, ModeratorScore
from arguenet.debate.voting import VotingAlgorithm

# Create test arguments
args = [
    Argument(
        agent_id="advocate",
        round=1,
        update_type="initial",
        update_reasoning="test",
        targets=[],
        argument="Position A is better",
        claims=["Claim 1"],
        confidence=0.9,
        position_delta=0.0,
        sources=[]
    ),
    # ... more arguments
]

# Create test scores
scores = [
    ModeratorScore(
        agent_id="advocate",
        round=1,
        relevance=0.9,
        evidence_quality=0.85,
        novelty=0.7,
        rebuttal_force=0.8,
        weighted_score=0.86,
        weakest_dimension="novelty",
        you_must_respond_to=[]
    ),
    # ... more scores
]

# Test voting
voter = VotingAlgorithm()
result = voter.execute(args, scores)

print(f"Mode: {result.voting_mode.value}")
print(f"Answer: {result.consensus_answer}")
print(f"Strength: {result.consensus_strength:.2%}")


ADVANCED CUSTOMIZATION
======================

1. Customize moderator weights:
   
   In VotingAlgorithm.vote_weighted_consensus():
   score_value = (
       relevance * 0.4 +        # Adjust weights
       evidence_quality * 0.3 +
       novelty * 0.2 +
       rebuttal_force * 0.1
   )

2. Add semantic similarity:
   
   from sentence_transformers import SentenceTransformer
   model = SentenceTransformer('all-MiniLM-L6-v2')
   
   In vote_similarity_cluster():
   vote.position_embedding = model.encode(vote.argument)

3. Custom voting modes:
   
   class MyVotingAlgorithm(VotingAlgorithm):
       def vote_custom(self, votes):
           # Your logic here
           return VotingResult(...)


DEBUGGING TIPS
==============

Low consensus strength?
  → Agents have high disagreement
  → Try forcing different voting mode
  → Check moderator scores for quality

Mode fallback loops?
  → At least 1 argument needs confidence > 0.3
  → Moderator scores must match argument count
  → Use CONFIDENCE_WEIGHTED as fallback

Unexpected winner?
  → Check moderator score weights
  → Review get_effective_confidence() calculation
  → Verify agent confidence values


PERFORMANCE
===========

Time Complexity: O(n) where n = number of agents (4)
Space Complexity: O(n) for vote storage
Latency: < 10ms per voting execution
History: All results in voter.voting_history for audit


NEXT STEPS
==========

1. Integrate into main.py
2. Test with mock data
3. Monitor voting_breakdown output
4. Tune moderator weights if needed
5. Consider early termination on strong consensus


SUPPORT
=======

For detailed examples, see:
  arguenet/debate/voting_integration_example.py

For API details, see docstrings in:
  arguenet/debate/voting.py
  arguenet/debate/key_updates.py
"""
