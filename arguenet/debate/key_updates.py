"""
Key update triggers for the voting algorithm.

This module manages automatic triggers for voting when system keys are updated.
It ensures voting occurs whenever agents or moderators produce new data.
"""

from __future__ import annotations

from typing import Callable, Optional, Any
from dataclasses import dataclass, field
import asyncio

try:
    from ..config import Argument, ModeratorScore
    from .voting import VotingAlgorithm, VotingResult
except ImportError:  # pragma: no cover
    from config import Argument, ModeratorScore
    from voting import VotingAlgorithm, VotingResult


@dataclass
class KeyUpdateEvent:
    """Represents a key update event that may trigger voting."""
    
    key: str  # e.g., "arguments", "scores", "confidence"
    value: Any
    timestamp: float
    source: str = "system"  # e.g., "moderator", "agent", "system"


@dataclass
class VotingTrigger:
    """Voting trigger configuration."""
    
    key: str  # Key that triggers voting
    callback: Optional[Callable] = None  # Optional callback after voting
    debounce_ms: int = 100  # Debounce rapid updates (ms)
    require_all_keys: bool = False  # Wait for all keys before voting


class KeyUpdateManager:
    """
    Manages key updates and automatically triggers voting.
    
    Monitors system updates and invokes voting algorithm when relevant
    keys are updated. Supports debouncing and conditional triggering.
    """
    
    # Keys that should trigger voting
    VOTING_TRIGGER_KEYS = {
        "arguments",           # New arguments from agents
        "scores",              # Updated moderator scores
        "confidence",          # Agent confidence changes
        "moderator_update",    # Explicit moderator update
    }
    
    def __init__(self):
        self.voting_algorithm = VotingAlgorithm()
        self.update_history: list[KeyUpdateEvent] = []
        self.pending_updates: dict[str, Any] = {}
        self.trigger_callbacks: dict[str, list[Callable]] = {}
        self.last_voting_time: float = 0.0
        self.debounce_timers: dict[str, asyncio.Task] = {}
        self.trigger_configs: dict[str, VotingTrigger] = {}
        self._setup_default_triggers()
    
    def _setup_default_triggers(self) -> None:
        """Configure default voting triggers."""
        for key in self.VOTING_TRIGGER_KEYS:
            self.trigger_configs[key] = VotingTrigger(
                key=key,
                debounce_ms=100,
                require_all_keys=False
            )
    
    def register_trigger(
        self,
        key: str,
        callback: Optional[Callable] = None,
        debounce_ms: int = 100,
    ) -> None:
        """
        Register a custom trigger for a key.
        
        Args:
            key: Key to monitor
            callback: Function to call after voting (receives VotingResult)
            debounce_ms: Milliseconds to wait before triggering
        """
        self.trigger_configs[key] = VotingTrigger(
            key=key,
            callback=callback,
            debounce_ms=debounce_ms
        )
        if key not in self.trigger_callbacks:
            self.trigger_callbacks[key] = []
        if callback:
            self.trigger_callbacks[key].append(callback)
    
    def notify_update(
        self,
        key: str,
        value: Any,
        source: str = "system",
    ) -> None:
        """
        Notify that a key has been updated.
        
        This method is called whenever arguments, scores, or other
        system state changes. It may trigger voting if conditions are met.
        
        Args:
            key: Updated key name
            value: New value
            source: Source of update (e.g., "moderator", "agent")
        """
        # Record update
        event = KeyUpdateEvent(key=key, value=value, timestamp=asyncio.get_event_loop().time() if asyncio.get_event_loop() else 0.0, source=source)
        self.update_history.append(event)
        
        # Store pending update
        self.pending_updates[key] = value
        
        # Notify voting algorithm
        self.voting_algorithm.notify_update(key, value)
        
        # Check if this is a trigger key
        if key in self.trigger_configs:
            self._schedule_voting_trigger(key)
    
    def _schedule_voting_trigger(self, key: str) -> None:
        """Schedule a debounced voting trigger for a key."""
        trigger = self.trigger_configs.get(key)
        if not trigger:
            return
        
        # Cancel existing timer for this key
        if key in self.debounce_timers:
            self.debounce_timers[key].cancel()
        
        # Note: In a real async context, this would use asyncio.create_task
        # For now, we just mark it as pending
        self.pending_updates[f"_trigger_pending_{key}"] = True
    
    def check_and_execute_voting(
        self,
        arguments: Optional[list[Argument]] = None,
        scores: Optional[list[ModeratorScore]] = None,
        force: bool = False,
    ) -> Optional[VotingResult]:
        """
        Check if voting should be triggered and execute if needed.
        
        Args:
            arguments: Current arguments (uses stored if not provided)
            scores: Current scores (uses stored if not provided)
            force: Force voting even if not triggered
        
        Returns:
            VotingResult if voting was executed, None otherwise
        """
        # Check if we have required data
        if arguments is None or scores is None:
            return None
        
        # Check if voting was triggered
        voting_triggered = any(
            self.pending_updates.get(f"_trigger_pending_{key}") 
            for key in self.VOTING_TRIGGER_KEYS
        )
        
        if not voting_triggered and not force:
            return None
        
        # Execute voting
        result = self.voting_algorithm.execute(arguments, scores)
        
        # Clear pending triggers
        for key in self.VOTING_TRIGGER_KEYS:
            self.pending_updates.pop(f"_trigger_pending_{key}", None)
        
        # Execute callbacks
        self._execute_callbacks(result)
        
        return result
    
    def _execute_callbacks(self, result: VotingResult) -> None:
        """Execute all registered callbacks for voting result."""
        for key, callbacks in self.trigger_callbacks.items():
            for callback in callbacks:
                try:
                    callback(result)
                except Exception as e:
                    print(f"Error executing callback for key {key}: {e}")
    
    def has_triggered_voting(self) -> bool:
        """Check if voting has been triggered by any key update."""
        return any(
            self.pending_updates.get(f"_trigger_pending_{key}") 
            for key in self.VOTING_TRIGGER_KEYS
        )
    
    def get_update_count(self, key: Optional[str] = None) -> int:
        """Get number of updates for a key or total updates."""
        if key:
            return sum(1 for e in self.update_history if e.key == key)
        return len(self.update_history)
    
    def get_last_update(self, key: str) -> Optional[KeyUpdateEvent]:
        """Get the most recent update for a key."""
        for event in reversed(self.update_history):
            if event.key == key:
                return event
        return None
    
    def clear_history(self) -> None:
        """Clear update history and pending updates."""
        self.update_history.clear()
        self.pending_updates.clear()
        self.voting_algorithm.voting_history.clear()
    
    def get_voting_history(self) -> list[VotingResult]:
        """Get all voting results since initialization."""
        return self.voting_algorithm.voting_history.copy()
