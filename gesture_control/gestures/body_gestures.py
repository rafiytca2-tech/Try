"""Gestures from the Kinect SDK skeleton: native hand states and raised hands."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from ..types import Body
from .signal import StateBank

Emitted = Tuple[str, str, Optional[str], Dict]  # (name, phase, side, data)

HAND_STATE_GESTURES = {"open": "HAND_OPEN", "closed": "HAND_CLOSED", "lasso": "HAND_LASSO"}


def nearest_body(bodies: List[Body]) -> Optional[Body]:
    """The person closest to the sensor (so bystanders do not steal control)."""
    best, best_z = None, float("inf")
    for body in bodies:
        joint = body.joints.get("SpineBase") or body.joints.get("SpineMid") or body.joints.get("Head")
        z = joint.position[2] if joint else float("inf")
        if best is None or z < best_z:
            best, best_z = body, z
    return best


class BodyGestures:
    def __init__(self, cfg: Dict):
        self.margin = float(cfg.get("raise_margin", 0.05))
        self.states = StateBank(float(cfg.get("min_on", 0.2)), 0.15)
        self.hand_state_on = float(cfg.get("hand_state_min_on", 0.12))

    def update(self, bodies: List[Body], t: float) -> List[Emitted]:
        out: List[Emitted] = []
        body = nearest_body(bodies)
        if body is None:
            for (name, side), phase in self.states.release_all():
                out.append((name, phase, side, {}))
            return out

        def state(name, side, value, min_on=None, min_off=None):
            phase = self.states.update((name, side), value, t, min_on=min_on, min_off=min_off)
            if phase:
                out.append((name, phase, side, {"tracking_id": body.tracking_id}))

        head = body.joints.get("Head")
        raised = {}
        for side in ("left", "right"):
            hand_state = body.hand_states.get(side, "unknown")
            for kinect_state, name in HAND_STATE_GESTURES.items():
                # "unknown" frames are common mid-gesture; keep states alive through short gaps
                state(name, side, hand_state == kinect_state, self.hand_state_on, 0.2)
            hand = body.joints.get("HandRight" if side == "right" else "HandLeft")
            raised[side] = bool(head and hand and hand.position[1] > head.position[1] + self.margin)
            state("RAISE_HAND", side, raised[side])
        state("BOTH_HANDS_UP", None, raised["left"] and raised["right"])
        return out
