"""Facial-expression gestures: smile, mouth open, brows, winks and blinks."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from ..types import TRIGGER, Face
from .signal import Hysteresis, StateBank

Emitted = Tuple[str, str, Dict]  # (name, phase, data)


class FaceGestures:
    def __init__(self, cfg: Dict):
        self.cfg = cfg
        th = cfg.get("thresholds", {})

        def hyst(key, default):
            on, off = th.get(key, default)
            return Hysteresis(on, off)

        self.smile = hyst("smile", (0.55, 0.35))
        self.mouth = hyst("mouth_open", (0.45, 0.25))
        self.brows = hyst("brows_up", (0.5, 0.3))
        self.eye_l = hyst("eye_closed", (0.55, 0.35))
        self.eye_r = hyst("eye_closed", (0.55, 0.35))
        self.custom = {
            str(name).upper(): (spec["blendshape"], Hysteresis(spec.get("on", 0.5), spec.get("off", 0.3)))
            for name, spec in (cfg.get("blendshape_gestures") or {}).items()
        }
        self.states = StateBank(float(cfg.get("min_on", 0.2)), 0.1)
        self.swap_eyes = bool(cfg.get("swap_eyes", False))
        self.blink_max = float(cfg.get("blink_max", 0.4))
        self.double_window = float(cfg.get("double_blink_window", 0.8))
        self._closed_since: Optional[float] = None
        self._last_blink = float("-inf")

    def update(self, face: Optional[Face], t: float) -> List[Emitted]:
        out: List[Emitted] = []
        if face is None:
            for key, phase in self.states.release_all():
                out.append((key, phase, {}))
            for h in (self.smile, self.mouth, self.brows, self.eye_l, self.eye_r):
                h.update(None)
            self._closed_since = None
            return out

        m = face.metrics
        left, right = m["eye_left"], m["eye_right"]
        if self.swap_eyes:
            left, right = right, left
        l_closed = self.eye_l.update(left)
        r_closed = self.eye_r.update(right)
        both = l_closed and r_closed

        def state(name, value, min_on=None, data=None):
            phase = self.states.update(name, value, t, min_on=min_on)
            if phase:
                out.append((name, phase, data or {}))

        state("SMILE", self.smile.update(m["smile"]), data={"score": round(m["smile"], 2)})
        state("MOUTH_OPEN", self.mouth.update(m["mouth_open"]), data={"score": round(m["mouth_open"], 2)})
        state("BROWS_RAISED", self.brows.update(m["brows_up"]), data={"score": round(m["brows_up"], 2)})
        state("EYES_CLOSED", both, min_on=float(self.cfg.get("eyes_closed_min_on", 0.6)))
        wink_on = float(self.cfg.get("wink_min_on", 0.25))
        state("WINK_LEFT", l_closed and not r_closed, min_on=wink_on)
        state("WINK_RIGHT", r_closed and not l_closed, min_on=wink_on)
        for name, (blendshape, hyst) in self.custom.items():
            value = face.blendshapes.get(blendshape)
            state(name, hyst.update(value), data={"score": round(value or 0.0, 2)})

        # Blinks: both eyes closed briefly
        if both and self._closed_since is None:
            self._closed_since = t
        elif not both and self._closed_since is not None:
            duration = t - self._closed_since
            self._closed_since = None
            if duration <= self.blink_max:
                out.append(("BLINK", TRIGGER, {"duration": round(duration, 3)}))
                if t - self._last_blink <= self.double_window:
                    out.append(("DOUBLE_BLINK", TRIGGER, {}))
                    self._last_blink = float("-inf")
                else:
                    self._last_blink = t
        return out

