"""Per-camera gesture engine: turns a stream of Observations into GestureEvents."""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from ..config import HAND_POSES
from ..types import GestureEvent, Hand, Observation
from .body_gestures import BodyGestures, nearest_body
from .face_gestures import FaceGestures
from .hand_motion import HandMotion, Sample
from .head_gestures import HeadGestures
from .signal import StateBank

SIDES = ("left", "right")
KINECT_STATE_TO_POSE = {"open": "OPEN_PALM", "closed": "FIST", "lasso": "VICTORY"}


def palm_scale(hand: Hand, aspect: float) -> float:
    """Apparent palm size in frame-width units (mean of the palm triangle's sides)."""
    p = hand.landmarks[:, :2] * np.array([1.0, aspect])
    a, b, c = p[0], p[5], p[17]
    return float((np.linalg.norm(a - b) + np.linalg.norm(b - c) + np.linalg.norm(c - a)) / 3.0)


class GestureEngine:
    def __init__(self, source: str, cfg: Dict, trackers):
        self.source = source
        self.trackers = set(trackers)
        hands_cfg = cfg.get("hands", {})
        self.poses = StateBank(float(hands_cfg.get("pose_min_on", 0.15)),
                               float(hands_cfg.get("pose_min_off", 0.15)))
        self.motion = {side: HandMotion(hands_cfg) for side in SIDES}
        self.face = FaceGestures(cfg.get("face", {}))
        self.head = HeadGestures(cfg.get("head", {}))
        body_cfg = cfg.get("body", {})
        self.body = BodyGestures(body_cfg)
        self.body_motion = {side: HandMotion(hands_cfg) for side in SIDES} if body_cfg.get("motion", True) else {}

    def _event(self, name, category, phase, t, side=None, data=None) -> GestureEvent:
        return GestureEvent(name, category, phase, self.source, t, side, data or {})

    def update(self, obs: Observation) -> List[GestureEvent]:
        t = obs.frame.timestamp
        w, h = obs.frame.size
        aspect = h / w
        events: List[GestureEvent] = []

        if "hands" in self.trackers:
            for side in SIDES:
                hand = obs.hand(side)
                for pose in HAND_POSES:
                    phase = self.poses.update((pose, side), hand is not None and hand.pose == pose, t)
                    if phase:
                        events.append(self._event(pose, "hand", phase, t, side, {"fingers": hand.finger_count} if hand else {}))
                if hand is None:
                    self.motion[side].reset()
                    continue
                cx, cy = hand.palm_center()
                sample = Sample(t, float(cx), float(cy) * aspect, palm_scale(hand, aspect),
                                hand.depth_mm, hand.pose)
                for name, data in self.motion[side].update(sample):
                    events.append(self._event(name, "hand", "trigger", t, side, data))

        if "face" in self.trackers:
            face = obs.faces[0] if obs.faces else None
            for name, phase, data in self.face.update(face, t):
                events.append(self._event(name, "face", phase, t, data=data))
            for name, phase, data in self.head.update(face.head if face else None, t):
                events.append(self._event(name, "head", phase, t, data=data))

        if "body" in self.trackers:
            for name, phase, side, data in self.body.update(obs.bodies, t):
                events.append(self._event(name, "body", phase, t, side, data))
            if self.body_motion:
                events.extend(self._skeleton_motion(obs, t, w))
        return events

    def _skeleton_motion(self, obs: Observation, t: float, width: int) -> List[GestureEvent]:
        events = []
        body = nearest_body(obs.bodies)
        for side in SIDES:
            joint = body.joints.get("HandLeft" if side == "left" else "HandRight") if body else None
            if joint is None or joint.pixel is None or not joint.tracked:
                self.body_motion[side].reset()
                continue
            pose = KINECT_STATE_TO_POSE.get(body.hand_states.get(side, "unknown"))
            sample = Sample(t, joint.pixel[0] / width, joint.pixel[1] / width, None,
                            joint.position[2] * 1000.0, pose)
            for name, data in self.body_motion[side].update(sample):
                events.append(self._event(name, "body", "trigger", t, side, data))
        return events

    def release_all(self, t: float) -> List[GestureEvent]:
        """END every held gesture (used when the camera stops)."""
        events = []
        for (pose, side), phase in self.poses.release_all():
            events.append(self._event(pose, "hand", phase, t, side))
        for name, phase, data in self.face.update(None, t):
            events.append(self._event(name, "face", phase, t, data=data))
        for name, phase, data in self.head.update(None, t):
            events.append(self._event(name, "head", phase, t, data=data))
        for name, phase, side, data in self.body.update([], t):
            events.append(self._event(name, "body", phase, t, side, data))
        return events
