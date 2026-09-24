"""Head gestures from head pose: turn / look / tilt states, nod and shake."""

from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

from ..types import TRIGGER, HeadPose
from .signal import Hysteresis, StateBank, zigzag_legs

Emitted = Tuple[str, str, Dict]


class HeadGestures:
    def __init__(self, cfg: Dict):
        self.cfg = cfg
        hyst = float(cfg.get("hysteresis", 4))
        turn, look, tilt = (float(cfg.get(k, d)) for k, d in
                            (("turn_threshold", 18), ("look_threshold", 12), ("tilt_threshold", 15)))
        # (gesture, axis, sign, hysteresis)
        self.directions = [
            ("TURN_RIGHT", "yaw", 1, Hysteresis(turn, turn - hyst)),
            ("TURN_LEFT", "yaw", -1, Hysteresis(turn, turn - hyst)),
            ("LOOK_UP", "pitch", 1, Hysteresis(look, look - hyst)),
            ("LOOK_DOWN", "pitch", -1, Hysteresis(look, look - hyst)),
            ("TILT_RIGHT", "roll", 1, Hysteresis(tilt, tilt - hyst)),
            ("TILT_LEFT", "roll", -1, Hysteresis(tilt, tilt - hyst)),
        ]
        self.states = StateBank(float(cfg.get("min_on", 0.25)), 0.1)
        self.nod = cfg.get("nod", {})
        self.shake = cfg.get("shake", {})
        self.horizon = max(float(self.nod.get("window", 1.0)), float(self.shake.get("window", 1.2)))
        self.history: Deque[Tuple[float, float, float]] = deque()  # (t, yaw, pitch)
        self._last = {"nod": float("-inf"), "shake": float("-inf")}

    def update(self, head: Optional[HeadPose], t: float) -> List[Emitted]:
        out: List[Emitted] = []
        if head is None:
            for key, phase in self.states.release_all():
                out.append((key, phase, {}))
            for *_ignored, h in self.directions:
                h.update(None)
            self.history.clear()
            return out

        for name, axis, sign, hyst in self.directions:
            value = getattr(head, axis) * sign
            phase = self.states.update(name, hyst.update(value), t)
            if phase:
                out.append((name, phase, {axis: round(getattr(head, axis), 1)}))

        self.history.append((t, head.yaw, head.pitch))
        while self.history and t - self.history[0][0] > self.horizon:
            self.history.popleft()
        found = self._oscillation(t, "nod", pitch_axis=True) or self._oscillation(t, "shake", pitch_axis=False)
        if found:
            out.append(found)
        return out

    def _oscillation(self, t: float, kind: str, pitch_axis: bool) -> Optional[Emitted]:
        cfg = self.nod if kind == "nod" else self.shake
        if t - self._last[kind] < float(cfg.get("cooldown", 1.2)):
            return None
        window = [s for s in self.history if t - s[0] <= float(cfg.get("window", 1.0))]
        if len(window) < 5:
            return None
        main = [s[2] if pitch_axis else s[1] for s in window]
        other = [s[1] if pitch_axis else s[2] for s in window]
        legs = zigzag_legs(main, float(cfg.get("amplitude", 7)))
        if len(legs) < int(cfg.get("min_legs", 2)):
            return None
        # the other axis must stay comparatively still (a nod is not a head roll)
        if max(other) - min(other) > 0.8 * (max(main) - min(main)):
            return None
        self._last[kind] = t
        self.history.clear()
        return ("NOD" if kind == "nod" else "SHAKE"), TRIGGER, {"strokes": len(legs)}
