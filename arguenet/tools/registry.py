from __future__ import annotations

from dataclasses import dataclass, field

_CURRENT = None


@dataclass
class RoundSourceRegistry:
    round_num: int
    seen: set[str] = field(default_factory=set)

    def claim(self, source_key: str) -> bool:
        if source_key in self.seen:
            return False
        self.seen.add(source_key)
        return True


def set_registry(registry: RoundSourceRegistry | None) -> None:
    global _CURRENT
    _CURRENT = registry


def get_registry() -> RoundSourceRegistry | None:
    return _CURRENT
