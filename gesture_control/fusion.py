"""Merging gesture events from several cameras into one stream.

* Momentary gestures (swipe, nod ...) reported by different cameras within
  ``window`` seconds count once.
* Held gestures (fist, smile ...) are combined with OR: the fused gesture
  STARTs when the first camera sees it and ENDs when the last one stops.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Dict, List, Optional, Set, Tuple

from .types import END, START, TRIGGER, GestureEvent

Key = Tuple[str, Optional[str]]


class EventFusion:
    def __init__(self, window: float = 0.4, enabled: bool = True):
        self.window = float(window)
        self.enabled = enabled
        self._last_trigger: Dict[Key, Tuple[float, str]] = {}
        self._active: Dict[Key, Set[str]] = {}
        self._started: Dict[Key, GestureEvent] = {}

    def process(self, event: GestureEvent) -> List[GestureEvent]:
        if not self.enabled:
            return [event]
        key = (event.name, event.side)
        if event.phase == TRIGGER:
            last = self._last_trigger.get(key)
            if last and last[1] != event.source and event.timestamp - last[0] < self.window:
                return []
            self._last_trigger[key] = (event.timestamp, event.source)
            return [event]
        if event.phase == START:
            active = self._active.setdefault(key, set())
            first = not active
            active.add(event.source)
            if first:
                self._started[key] = event
                return [event]
            return []
        if event.phase == END:
            active = self._active.get(key)
            if not active or event.source not in active:
                return []
            active.discard(event.source)
            if not active:
                self._started.pop(key, None)
                return [event]
        return []

    def drop_source(self, source: str, timestamp: float) -> List[GestureEvent]:
        """A camera went away: end whatever only it was holding."""
        ended = []
        for key, active in self._active.items():
            if source in active:
                active.discard(source)
                if not active:
                    start = self._started.pop(key, None)
                    if start is not None:
                        ended.append(replace(start, phase=END, timestamp=timestamp, source=source, data={}))
        return ended
