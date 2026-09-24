"""Small building blocks for turning noisy per-frame signals into gestures."""

from __future__ import annotations

from typing import Dict, Hashable, Iterable, List, Optional, Tuple

from ..types import END, START


def zigzag_legs(values: Iterable[float], threshold: float) -> List[float]:
    """Signed amplitudes of the strokes in ``values``, ignoring moves < threshold.

    ``[0, 10, 0, 10]`` with threshold 5 gives ``[10, -10, 10]``: three legs.
    Used to count nods, head shakes and waves.
    """
    it = iter(values)
    try:
        first = next(it)
    except StopIteration:
        return []
    lo = hi = first
    lo_seen_last = False
    direction = 0
    pivot = extreme = first
    legs: List[float] = []
    for v in it:
        if direction == 0:
            if v < lo:
                lo, lo_seen_last = v, True
            if v > hi:
                hi, lo_seen_last = v, False
            if hi - lo >= threshold:
                if lo_seen_last:  # the low came last: first stroke is downward
                    pivot, extreme, direction = hi, lo, -1
                else:
                    pivot, extreme, direction = lo, hi, 1
            continue
        if direction == 1:
            if v > extreme:
                extreme = v
            elif extreme - v >= threshold:
                legs.append(extreme - pivot)
                pivot, extreme, direction = extreme, v, -1
        else:
            if v < extreme:
                extreme = v
            elif v - extreme >= threshold:
                legs.append(extreme - pivot)
                pivot, extreme, direction = extreme, v, 1
    if direction != 0:
        legs.append(extreme - pivot)
    return legs


class Hysteresis:
    """Boolean from a 0..1 (or any) score with separate on/off thresholds.

    ``on > off`` detects "score is high"; pass ``on < off`` to detect "low".
    """

    def __init__(self, on: float, off: float):
        self.on, self.off = float(on), float(off)
        self.state = False

    def update(self, value: Optional[float]) -> bool:
        if value is None:
            self.state = False
        elif self.on >= self.off:
            self.state = value >= self.on if not self.state else value > self.off
        else:
            self.state = value <= self.on if not self.state else value < self.off
        return self.state


class Debounced:
    """Emits START once ``value`` has been True for ``min_on`` seconds and END
    once it has been False for ``min_off`` seconds."""

    def __init__(self, min_on: float = 0.0, min_off: float = 0.0):
        self.min_on, self.min_off = float(min_on), float(min_off)
        self.active = False
        self.since: Optional[float] = None  # when the value last became active
        self._pending: Optional[float] = None

    def update(self, value: bool, t: float) -> Optional[str]:
        if bool(value) == self.active:
            self._pending = None
            return None
        if self._pending is None:
            self._pending = t
        needed = self.min_on if value else self.min_off
        if t - self._pending < needed - 1e-6:  # tolerate float timestamp jitter
            return None
        self.active = bool(value)
        self.since = self._pending if self.active else None
        self._pending = None
        return START if self.active else END


class StateBank:
    """A dict of ``Debounced`` keyed by (gesture, side) with shared defaults."""

    def __init__(self, min_on: float = 0.0, min_off: float = 0.0):
        self.min_on, self.min_off = min_on, min_off
        self._states: Dict[Hashable, Debounced] = {}

    def update(self, key: Hashable, value: bool, t: float,
               min_on: Optional[float] = None, min_off: Optional[float] = None) -> Optional[str]:
        state = self._states.get(key)
        if state is None:
            state = self._states[key] = Debounced(
                self.min_on if min_on is None else min_on,
                self.min_off if min_off is None else min_off,
            )
        return state.update(value, t)

    def active_keys(self) -> List[Hashable]:
        return [k for k, s in self._states.items() if s.active]

    def is_active(self, key: Hashable) -> bool:
        s = self._states.get(key)
        return bool(s and s.active)

    def release_all(self) -> List[Tuple[Hashable, str]]:
        """Force every active state off (e.g. the camera went away)."""
        ended = []
        for key, state in self._states.items():
            if state.active:
                state.active = False
                state._pending = None
                ended.append((key, END))
        return ended
