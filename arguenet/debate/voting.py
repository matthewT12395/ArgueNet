"""
Voting algorithm for multi-agent consensus building.

This module provides sophisticated voting strategies that aggregate arguments
from multiple agents based on moderator scores and argument quality metrics.
The system can be triggered on key updates and supports multiple voting modes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from enum import Enum
import statistics

try:
    from ..config import Argument, ModeratorScore
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore


class VotingMode(str, Enum):
    """Voting strategies for reaching consensus."""
    
    # Require unanimous agreement from all agents
    UNANIMITY = "unanimity"
    
    # Require supermajority (3/4 agents) aligned on similar positions
    SUPERMAJORITY = "supermajority"
    
    # Weighted voting based on moderator scores
    WEIGHTED_CONSENSUS = "weighted_consensus"
    
    # Pure majority rule (3+ agents supporting a position)
    MAJORITY = "majority"
    
    # Similarity clustering - agents grouped by position similarity
    SIMILARITY_CLUSTER = "similarity_cluster"
    
    # Confidence-weighted: agents weighted by their own confidence + moderator score
    CONFIDENCE_WEIGHTED = "confidence_weighted"


@dataclass
class AgentVote:
    """Represents a single agent's vote in the consensus process."""
    
    agent_id: str
    argument: str
    confidence: float
    moderator_score: Optional[ModeratorScore] = None
    position_embedding: Optional[str] = None  # Placeholder for position representation
    weight: float = 1.0
    
    def get_effective_confidence(self) -> float:
        """Calculate effective confidence by combining agent confidence and moderator score."""
        base_confidence = self.confidence
        
        if self.moderator_score:
            # Weighted average of moderator dimensions
            moderator_quality = (
                self.moderator_score.relevance * 0.3 +
                self.moderator_score.evidence_quality * 0.4 +
                self.moderator_score.novelty * 0.2 +
                self.moderator_score.rebuttal_force * 0.1
            )
            # Blend agent confidence with moderator assessment
            return (base_confidence * 0.6 + moderator_quality * 0.4)
        
        return base_confidence


@dataclass
class VotingResult:
    """Result of the voting process."""
    
    consensus_answer: str
    consensus_confidence: float
    voting_mode: VotingMode
    votes: list[AgentVote] = field(default_factory=list)
    agent_alignment: dict[str, float] = field(default_factory=dict)  # Agreement scores per agent
    dissent_reasons: list[str] = field(default_factory=list)
    voting_breakdown: dict = field(default_factory=dict)  # Detailed voting stats
    unanimity_achieved: bool = False
    supermajority_achieved: bool = False
    consensus_strength: float = 0.0  # 0.0-1.0: how strong is this consensus?
    
    def to_dict(self) -> dict:
        """Convert voting result to dictionary for JSON serialization."""
        return {
            "consensus_answer": self.consensus_answer,
            "consensus_confidence": self.consensus_confidence,
            "voting_mode": self.voting_mode.value,
            "agent_alignment": self.agent_alignment,
            "dissent_reasons": self.dissent_reasons,
            "voting_breakdown": self.voting_breakdown,
            "unanimity_achieved": self.unanimity_achieved,
            "supermajority_achieved": self.supermajority_achieved,
            "consensus_strength": self.consensus_strength,
        }


class VotingAlgorithm:
    """
    Multi-strategy voting system for agent consensus.
    
    Triggers on key updates and selects the most appropriate voting mode
    based on argument diversity and moderator feedback.
    """
    
    def __init__(self):
        self.voting_history: list[VotingResult] = []
        self.update_keys: set[str] = set()
    
    def notify_update(self, key: str, value: any) -> None:
        """
        Trigger voting algorithm when a key is updated.
        Called whenever agents or moderator produce new data.
        """
        self.update_keys.add(key)
    
    def build_votes(
        self,
        arguments: list[Argument],
        scores: list[ModeratorScore],
    ) -> list[AgentVote]:
        """Convert arguments and moderator scores into structured votes."""
        
        # Create score lookup
        score_map = {score.agent_id: score for score in scores}
        
        votes = []
        for arg in arguments:
            vote = AgentVote(
                agent_id=arg.agent_id,
                argument=arg.argument,
                confidence=arg.confidence,
                moderator_score=score_map.get(arg.agent_id),
                weight=1.0,
            )
            votes.append(vote)
        
        return votes
    
    def vote_unanimity(self, votes: list[AgentVote]) -> Optional[VotingResult]:
        """
        UNANIMITY mode: All non-moderator agents must agree substantially.
        
        Returns consensus if 4/4 agents have high agreement on similar positions.
        """
        if len(votes) < 4:
            return None
        
        # Check if all votes express similar positions (simplified: same confidence band)
        confidence_values = [v.confidence for v in votes]
        avg_confidence = statistics.mean(confidence_values)
        
        # All agents within 0.1 confidence points?
        if max(confidence_values) - min(confidence_values) <= 0.1:
            # Group votes by argument similarity (simplified: use the highest confidence one)
            top_vote = max(votes, key=lambda v: v.get_effective_confidence())
            
            return VotingResult(
                consensus_answer=top_vote.argument,
                consensus_confidence=avg_confidence,
                voting_mode=VotingMode.UNANIMITY,
                votes=votes,
                unanimity_achieved=True,
                consensus_strength=0.95,
                voting_breakdown={
                    "mode": "unanimity",
                    "alignment": 1.0,
                    "agents_voting": len(votes),
                    "avg_confidence": avg_confidence,
                }
            )
        
        return None
    
    def vote_supermajority(self, votes: list[AgentVote]) -> Optional[VotingResult]:
        """
        SUPERMAJORITY mode: 3/4 agents must support the same position.
        
        Requires 75% agent agreement. Lower threshold than unanimity.
        """
        if len(votes) < 3:
            return None
        
        # Sort by effective confidence
        sorted_votes = sorted(
            votes,
            key=lambda v: v.get_effective_confidence(),
            reverse=True
        )
        
        # Check if top 3 votes have similar confidence
        top_3_confidence = [v.get_effective_confidence() for v in sorted_votes[:3]]
        avg_top_3 = statistics.mean(top_3_confidence)
        
        if max(top_3_confidence) - min(top_3_confidence) <= 0.15:
            top_vote = sorted_votes[0]
            
            # Check if 4th agent dissents significantly
            dissent_reasons = []
            if len(votes) > 3 and votes[3].confidence < 0.5:
                dissent_reasons.append(f"{votes[3].agent_id}: Low confidence ({votes[3].confidence:.2f})")
            
            return VotingResult(
                consensus_answer=top_vote.argument,
                consensus_confidence=avg_top_3,
                voting_mode=VotingMode.SUPERMAJORITY,
                votes=votes,
                supermajority_achieved=True,
                dissent_reasons=dissent_reasons,
                consensus_strength=0.75,
                voting_breakdown={
                    "mode": "supermajority",
                    "majority_size": 3,
                    "majority_confidence": avg_top_3,
                    "agents_voting": len(votes),
                }
            )
        
        return None
    
    def vote_weighted_consensus(self, votes: list[AgentVote]) -> VotingResult:
        """
        WEIGHTED CONSENSUS: Score each vote based on moderator assessment.
        
        Each agent's vote is weighted by their moderator score across all dimensions.
        Falls back to confidence-weighted if moderator scores unavailable.
        """
        # Calculate weights based on moderator scores
        for vote in votes:
            if vote.moderator_score:
                # Combined score from moderator dimensions
                score_value = (
                    vote.moderator_score.relevance * 0.35 +
                    vote.moderator_score.evidence_quality * 0.35 +
                    vote.moderator_score.novelty * 0.15 +
                    vote.moderator_score.rebuttal_force * 0.15
                )
                vote.weight = max(0.1, score_value)  # Min weight to keep all agents relevant
            else:
                vote.weight = vote.confidence
        
        # Normalize weights
        total_weight = sum(v.weight for v in votes)
        if total_weight > 0:
            for vote in votes:
                vote.weight /= total_weight
        
        # Weighted selection: pick highest-weighted agent's position
        weighted_votes = sorted(votes, key=lambda v: v.weight, reverse=True)
        consensus_vote = weighted_votes[0]
        
        # Calculate weighted confidence
        weighted_confidence = sum(v.weight * v.confidence for v in votes)
        
        # Calculate alignment scores per agent
        agent_alignment = {v.agent_id: v.weight for v in votes}
        
        # Identify dissenters
        dissent_reasons = []
        for vote in votes:
            if vote.confidence < 0.4 and vote != consensus_vote:
                dissent_reasons.append(
                    f"{vote.agent_id}: Low confidence ({vote.confidence:.2f})"
                )
        
        return VotingResult(
            consensus_answer=consensus_vote.argument,
            consensus_confidence=weighted_confidence,
            voting_mode=VotingMode.WEIGHTED_CONSENSUS,
            votes=votes,
            agent_alignment=agent_alignment,
            dissent_reasons=dissent_reasons,
            consensus_strength=weighted_votes[0].weight,
            voting_breakdown={
                "mode": "weighted_consensus",
                "vote_weights": {v.agent_id: round(v.weight, 3) for v in votes},
                "weighted_confidence": round(weighted_confidence, 3),
                "consensus_vote_weight": round(weighted_votes[0].weight, 3),
            }
        )
    
    def vote_majority(self, votes: list[AgentVote]) -> Optional[VotingResult]:
        """
        MAJORITY mode: 3+ agents must support the position (50%+ threshold).
        
        More permissive than supermajority. Works well for diverse debates.
        """
        if len(votes) < 3:
            return None
        
        # Sort by confidence
        sorted_votes = sorted(
            votes,
            key=lambda v: v.get_effective_confidence(),
            reverse=True
        )
        
        # Majority is threshold 3/4 agents or simple majority
        majority_threshold = max(3, (len(votes) // 2) + 1)
        
        if len(sorted_votes) >= majority_threshold:
            # Take top votes that meet minimum confidence
            majority_votes = [v for v in sorted_votes if v.get_effective_confidence() >= 0.4]
            
            if len(majority_votes) >= majority_threshold:
                consensus_vote = majority_votes[0]
                avg_majority_confidence = statistics.mean(
                    [v.get_effective_confidence() for v in majority_votes[:majority_threshold]]
                )
                
                dissent_reasons = [
                    f"{v.agent_id}: Low confidence ({v.confidence:.2f})"
                    for v in votes if v.get_effective_confidence() < 0.4
                ]
                
                return VotingResult(
                    consensus_answer=consensus_vote.argument,
                    consensus_confidence=avg_majority_confidence,
                    voting_mode=VotingMode.MAJORITY,
                    votes=votes,
                    dissent_reasons=dissent_reasons,
                    consensus_strength=len(majority_votes) / len(votes),
                    voting_breakdown={
                        "mode": "majority",
                        "majority_threshold": majority_threshold,
                        "agents_in_majority": len(majority_votes),
                        "avg_majority_confidence": round(avg_majority_confidence, 3),
                    }
                )
        
        return None
    
    def vote_confidence_weighted(self, votes: list[AgentVote]) -> VotingResult:
        """
        CONFIDENCE WEIGHTED: Blend agent confidence with moderator assessment.
        
        Similar to weighted consensus but emphasizes agent confidence more heavily.
        """
        # Weight = (agent_confidence * 0.6) + (moderator_score * 0.4)
        for vote in votes:
            base_weight = vote.confidence
            
            if vote.moderator_score:
                moderator_avg = (
                    vote.moderator_score.relevance +
                    vote.moderator_score.evidence_quality +
                    vote.moderator_score.novelty +
                    vote.moderator_score.rebuttal_force
                ) / 4
                vote.weight = (base_weight * 0.6) + (moderator_avg * 0.4)
            else:
                vote.weight = base_weight
        
        # Normalize
        total_weight = sum(v.weight for v in votes)
        if total_weight > 0:
            for vote in votes:
                vote.weight /= total_weight
        
        # Select consensus
        consensus_vote = max(votes, key=lambda v: v.weight)
        weighted_confidence = sum(v.weight * v.confidence for v in votes)
        
        return VotingResult(
            consensus_answer=consensus_vote.argument,
            consensus_confidence=weighted_confidence,
            voting_mode=VotingMode.CONFIDENCE_WEIGHTED,
            votes=votes,
            agent_alignment={v.agent_id: v.weight for v in votes},
            consensus_strength=max(v.weight for v in votes),
            voting_breakdown={
                "mode": "confidence_weighted",
                "vote_weights": {v.agent_id: round(v.weight, 3) for v in votes},
                "weighted_confidence": round(weighted_confidence, 3),
            }
        )
    
    def vote_similarity_cluster(self, votes: list[AgentVote]) -> VotingResult:
        """
        SIMILARITY CLUSTER: Group agents by argument similarity.
        
        Clusters agents into camps and picks the largest cluster's position.
        Useful for identifying fault lines in debate.
        """
        # For now, use confidence bands as proxy for position similarity
        # In production, use embeddings for semantic similarity
        
        confidence_bands = {}
        for vote in votes:
            band = round(vote.confidence * 10) / 10  # Bin into 0.1 bands
            if band not in confidence_bands:
                confidence_bands[band] = []
            confidence_bands[band].append(vote)
        
        # Largest cluster
        largest_cluster = max(confidence_bands.values(), key=len)
        consensus_vote = max(largest_cluster, key=lambda v: v.confidence)
        cluster_confidence = statistics.mean([v.confidence for v in largest_cluster])
        
        # Identify opposing clusters
        dissent_reasons = []
        for band, cluster in confidence_bands.items():
            if cluster != largest_cluster:
                dissent_reasons.append(
                    f"Cluster at confidence {band:.1f}: {', '.join(v.agent_id for v in cluster)}"
                )
        
        return VotingResult(
            consensus_answer=consensus_vote.argument,
            consensus_confidence=cluster_confidence,
            voting_mode=VotingMode.SIMILARITY_CLUSTER,
            votes=votes,
            dissent_reasons=dissent_reasons,
            consensus_strength=len(largest_cluster) / len(votes),
            voting_breakdown={
                "mode": "similarity_cluster",
                "cluster_size": len(largest_cluster),
                "cluster_members": [v.agent_id for v in largest_cluster],
                "num_clusters": len(confidence_bands),
                "cluster_confidence": round(cluster_confidence, 3),
            }
        )
    
    def select_voting_mode(
        self,
        votes: list[AgentVote],
        scores: list[ModeratorScore],
        force_mode: Optional[VotingMode] = None,
    ) -> VotingMode:
        """
        Automatically select the best voting mode based on debate state.
        
        Strategy:
        1. If force_mode specified, use that
        2. Check if unanimity possible (high alignment)
        3. Check if supermajority possible
        4. Fall back to weighted consensus
        """
        if force_mode:
            return force_mode
        
        # Calculate alignment metric
        confidence_std = statistics.stdev([v.confidence for v in votes]) if len(votes) > 1 else 0
        
        if confidence_std < 0.08:
            return VotingMode.UNANIMITY
        elif confidence_std < 0.15:
            return VotingMode.SUPERMAJORITY
        elif confidence_std < 0.25:
            return VotingMode.MAJORITY
        elif len(scores) == len(votes) and all(s for s in scores):
            return VotingMode.WEIGHTED_CONSENSUS
        else:
            return VotingMode.CONFIDENCE_WEIGHTED
    
    def execute(
        self,
        arguments: list[Argument],
        moderator_scores: list[ModeratorScore],
        force_mode: Optional[VotingMode] = None,
    ) -> VotingResult:
        """
        Execute the voting algorithm.
        
        Main entry point. Builds votes, selects mode, executes voting.
        Triggered automatically when arguments or scores are updated.
        """
        # Build votes from arguments and scores
        votes = self.build_votes(arguments, moderator_scores)
        
        if not votes:
            return VotingResult(
                consensus_answer="No consensus: no arguments provided",
                consensus_confidence=0.0,
                voting_mode=VotingMode.WEIGHTED_CONSENSUS,
            )
        
        # Select voting mode
        selected_mode = self.select_voting_mode(votes, moderator_scores, force_mode)
        
        # Execute voting
        if selected_mode == VotingMode.UNANIMITY:
            result = self.vote_unanimity(votes)
            if result:
                result.voting_mode = VotingMode.UNANIMITY
                self.voting_history.append(result)
                return result
            # Fall back
            selected_mode = VotingMode.SUPERMAJORITY
        
        if selected_mode == VotingMode.SUPERMAJORITY:
            result = self.vote_supermajority(votes)
            if result:
                result.voting_mode = VotingMode.SUPERMAJORITY
                self.voting_history.append(result)
                return result
            # Fall back
            selected_mode = VotingMode.MAJORITY
        
        if selected_mode == VotingMode.MAJORITY:
            result = self.vote_majority(votes)
            if result:
                result.voting_mode = VotingMode.MAJORITY
                self.voting_history.append(result)
                return result
            # Fall back to default
        
        if selected_mode == VotingMode.CONFIDENCE_WEIGHTED:
            result = self.vote_confidence_weighted(votes)
        elif selected_mode == VotingMode.SIMILARITY_CLUSTER:
            result = self.vote_similarity_cluster(votes)
        else:
            result = self.vote_weighted_consensus(votes)
        
        self.voting_history.append(result)
        return result
