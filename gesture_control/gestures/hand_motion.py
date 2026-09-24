"""Dynamic hand gestures from a hand's trajectory: swipes, push/pull and waving."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple

from .signal import zigzag_legs


@dataclass
class Sample:
    t: float
    x: float                    # frame-width units (0..1 across the image)
    y: float                    # also frame-width units, so distances are isotropic
    scale: Optional[float]      # apparent palm size, frame-width units
    depth: Optional[float]      # mm from the Kinect, None without depth
    pose: Optional[str]


class HandMotion:
    """Tracks one hand (one side, one camera) and reports motion gestures."""

    def __init__(self, cfg: Dict):
        self.swipe = cfg.get("swipe", {})
        self.push = cfg.get("push", {})
        self.wave = cfg.get("wave", {})
        horizon = max(float(self.swipe.get("window", 0.45)), float(self.push.get("window", 0.5)),
                      float(self.wave.get("window", 1.5)))
        self.horizon = horizon
        self.history: Deque[Sample] = deque()
        self._last = {"swipe": float("-inf"), "push": float("-inf"), "wave": float("-inf")}

    def reset(self) -> None:
        self.history.clear()

    def _window(self, t: float, seconds: float) -> List[Sample]:
        return [s for s in self.history if t - s.t <= seconds]

    def update(self, sample: Sample) -> List[Tuple[str, Dict]]:
        h = self.history
        if h and sample.t - h[-1].t > 0.3:  # hand was lost for a while: start over
            h.clear()
        h.append(sample)
        while h and sample.t - h[0].t > self.horizon:
            h.popleft()
        events: List[Tuple[str, Dict]] = []
        for detector in (self._wave, self._swipe, self._push):
            found = detector(sample.t)
            if found:
                events.append(found)
                break
        return events

    # ---------------------------------------------------------------- swipe
    def _swipe(self, t: float) -> Optional[Tuple[str, Dict]]:
        cfg = self.swipe
        if t - self._last["swipe"] < float(cfg.get("cooldown", 0.8)):
            return None
        poses = cfg.get("poses") or []
        now = self.history[-1]
        if poses and now.pose not in poses:
            return None
        window = self._window(t, float(cfg.get("window", 0.45)))
        if len(window) < 3:
            return None
        first = window[0]
        dx, dy = now.x - first.x, now.y - first.y
        dist, ratio = float(cfg.get("min_distance", 0.22)), float(cfg.get("axis_ratio", 2.0))
        name = None
        if abs(dx) >= dist and abs(dx) >= ratio * abs(dy):
            name = "SWIPE_RIGHT" if dx > 0 else "SWIPE_LEFT"
        elif abs(dy) >= dist and abs(dy) >= ratio * abs(dx):
            name = "SWIPE_DOWN" if dy > 0 else "SWIPE_UP"
        if name is None:
            return None
        self._fired("swipe", t)
        return name, {"dx": round(dx, 3), "dy": round(dy, 3), "duration": round(now.t - first.t, 3)}

    # ------------------------------------------------------------ push/pull
    def _push(self, t: float) -> Optional[Tuple[str, Dict]]:
        cfg = self.push
        if t - self._last["push"] < float(cfg.get("cooldown", 1.0)):
            return None
        window = self._window(t, float(cfg.get("window", 0.5)))
        if len(window) < 3:
            return None
        first, now = window[0], window[-1]
        lateral = ((now.x - first.x) ** 2 + (now.y - first.y) ** 2) ** 0.5
        if lateral > float(cfg.get("max_lateral", 0.12)):
            return None
        name, data = None, {}
        if first.depth and now.depth:
            dz = now.depth - first.depth
            travel = float(cfg.get("min_depth_mm", 120))
            if dz <= -travel:
                name = "PUSH"
            elif dz >= travel:
                name = "PULL"
            data = {"depth_change_mm": round(dz)}
        elif first.scale and now.scale and first.pose and first.pose == now.pose:
            # No depth: the palm looks bigger as it approaches the camera.  Only
            # trust this while the pose is unchanged (re-posing changes the size too).
            growth = now.scale / first.scale
            factor = float(cfg.get("min_scale", 1.3))
            if growth >= factor:
                name = "PUSH"
            elif growth <= 1.0 / factor:
                name = "PULL"
            data = {"scale_change": round(growth, 2)}
        if name is None:
            return None
        self._fired("push", t)
        return name, data

    # ----------------------------------------------------------------- wave
    def _wave(self, t: float) -> Optional[Tuple[str, Dict]]:
        cfg = self.wave
        if t - self._last["wave"] < float(cfg.get("cooldown", 1.5)):
            return None
        window = self._window(t, float(cfg.get("window", 1.5)))
        if len(window) < 6:
            return None
        poses = cfg.get("poses") or []
        if poses and sum(s.pose in poses for s in window) < 0.7 * len(window):
            return None
        legs = zigzag_legs([s.x for s in window], float(cfg.get("amplitude", 0.05)))
        if len(legs) < int(cfg.get("min_legs", 4)):
            return None
        self._fired("wave", t)
        # a wave is also a series of small swipes; make sure none fire right after
        self._last["swipe"] = t
        return "WAVE", {"strokes": len(legs)}

    def _fired(self, kind: str, t: float) -> None:
        self._last[kind] = t
        self.history.clear()
