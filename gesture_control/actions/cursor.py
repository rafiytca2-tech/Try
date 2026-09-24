"""Continuous mouse-pointer control from a hand or from head pose."""

from __future__ import annotations

import logging
from typing import Callable, Dict, Optional, Tuple, Union

import numpy as np

from ..filters import OneEuroFilter
from ..gestures.body_gestures import nearest_body
from ..types import Observation
from .backends import InputBackend

log = logging.getLogger(__name__)

POINTS = {"wrist": [0], "index_tip": [8], "palm": [0, 5, 9, 13, 17]}


def map_region(x: float, y: float, region) -> Tuple[float, float]:
    """Map a point inside ``region`` (x0, y0, x1, y1) to [0, 1]^2, clamped."""
    x0, y0, x1, y1 = region
    u = (x - x0) / max(1e-6, x1 - x0)
    v = (y - y0) / max(1e-6, y1 - y0)
    return float(np.clip(u, 0.0, 1.0)), float(np.clip(v, 0.0, 1.0))


def joystick(angle: float, deadzone: float, full: float) -> float:
    """Head angle -> -1..1 with a dead zone; ``full`` degrees gives full speed."""
    mag = abs(angle) - deadzone
    if mag <= 0:
        return 0.0
    return float(np.sign(angle) * min(1.0, mag / max(1e-6, full - deadzone)))


class CursorController:
    def __init__(self, cfg: Dict, backend: InputBackend,
                 screen: Union[Tuple[int, int], Callable[[], Tuple[int, int]]]):
        self.cfg = cfg
        self.backend = backend
        self._screen = screen  # a size, or a function detecting it on first use
        self.enabled = bool(cfg.get("enabled", False))
        self.mode = cfg.get("mode", "hand")
        self.source = cfg.get("source", "any")
        self.hand_side = cfg.get("hand", "right")
        self.point = POINTS[cfg.get("point", "palm")]
        self.region = cfg.get("region", [0.2, 0.15, 0.8, 0.75])
        self.pause_pose = cfg.get("pause_pose") or None
        self.head_mode = cfg.get("head_mode", "relative")
        self.head_range = cfg.get("head_range", [20, 12])
        self.head_speed = float(cfg.get("head_speed", 1500))
        self.deadzone = float(cfg.get("head_deadzone", 4))
        min_cutoff, beta = float(cfg.get("min_cutoff", 1.0)), float(cfg.get("beta", 0.02))
        self._fx = OneEuroFilter(min_cutoff, beta)
        self._fy = OneEuroFilter(min_cutoff, beta)
        self._last_key: Optional[Tuple[str, int]] = None
        self._last_t: Optional[float] = None
        self._residual = np.zeros(2)
        self.status = ""

    @property
    def screen(self) -> Tuple[int, int]:
        if callable(self._screen):
            self._screen = self._screen()
        return self._screen

    @property
    def active(self) -> bool:
        return self.enabled

    def toggle(self) -> None:
        self.enabled = not self.enabled
        self._reset()
        log.info("Cursor control %s (%s mode)", "ON" if self.enabled else "OFF", self.mode)

    def _reset(self) -> None:
        self._fx.reset()
        self._fy.reset()
        self._last_t = None
        self._residual[:] = 0

    def _candidates(self, observations: Dict[str, Observation]):
        if self.source != "any":
            obs = observations.get(self.source)
            return [obs] if obs else []
        return [o for o in observations.values() if o is not None]

    def update(self, observations: Dict[str, Observation]) -> None:
        if not self.enabled:
            self.status = ""
            return
        for obs in self._candidates(observations):
            if self.mode == "hand":
                if self._hand_point(obs) is None:
                    continue
            else:
                if not obs.faces:
                    continue
            key = (obs.source, obs.frame.index)
            if key == self._last_key:
                return  # nothing new since last time
            self._last_key = key
            if self.mode == "hand":
                self._update_hand(obs)
            else:
                self._update_head(obs)
            return
        self.status = "no target"
        self._last_t = None

    def _hand_point(self, obs: Observation) -> Optional[Tuple[float, float, Optional[str]]]:
        """Normalised (x, y, pose) of the steering hand: MediaPipe landmarks when
        available, otherwise the Kinect skeleton's hand joint (works at room scale)."""
        hand = obs.hand(self.hand_side)
        if hand is not None:
            px, py = hand.landmarks[self.point, :2].mean(axis=0)
            return float(px), float(py), hand.pose
        body = nearest_body(obs.bodies)
        joint = body.joints.get("HandRight" if self.hand_side == "right" else "HandLeft") if body else None
        if joint is not None and joint.pixel is not None:
            w, h = obs.frame.size
            return joint.pixel[0] / w, joint.pixel[1] / h, None
        return None

    def _update_hand(self, obs: Observation) -> None:
        px, py, pose = self._hand_point(obs)
        t = obs.frame.timestamp
        if self.pause_pose and pose == self.pause_pose:
            self.status = "paused"
            self._reset()
            return
        u, v = map_region(px, py, self.region)
        x = self._fx(u * (self.screen[0] - 1), t)
        y = self._fy(v * (self.screen[1] - 1), t)
        self.backend.move_to(x, y)
        self.status = f"at {int(x)},{int(y)}"

    def _update_head(self, obs: Observation) -> None:
        head = obs.faces[0].head
        t = obs.frame.timestamp
        w, h = self.screen
        if self.head_mode == "absolute":
            nx = np.clip(head.yaw / max(1e-6, self.head_range[0]), -1, 1)
            ny = np.clip(-head.pitch / max(1e-6, self.head_range[1]), -1, 1)
            x = self._fx((0.5 + 0.5 * nx) * (w - 1), t)
            y = self._fy((0.5 + 0.5 * ny) * (h - 1), t)
            self.backend.move_to(x, y)
            self.status = f"at {int(x)},{int(y)}"
            return
        if self._last_t is None:
            self._last_t = t
            return
        dt = min(0.1, max(0.0, t - self._last_t))
        self._last_t = t
        vx = joystick(head.yaw, self.deadzone, self.head_range[0])
        vy = -joystick(head.pitch, self.deadzone, self.head_range[1])
        step = self._residual + np.array([vx, vy]) * self.head_speed * dt
        whole = np.trunc(step)
        self._residual = step - whole
        if whole.any():
            self.backend.move_by(float(whole[0]), float(whole[1]))
        self.status = f"speed ({vx:+.2f}, {vy:+.2f})"
