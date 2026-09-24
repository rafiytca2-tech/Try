"""Per-camera perception: frame -> hands, faces (with head pose) and bodies."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np

from ..filters import OneEuroFilter
from ..gestures.hand_pose import classify
from ..types import Face, Frame, HeadPose, Observation
from .depth import depth_at
from .face_geometry import NOSE_TIP, face_metrics, head_pose

log = logging.getLogger(__name__)


class Perception:
    """Runs the trackers a source asked for.  Create and use it on one thread:
    MediaPipe graphs are not thread-safe and need increasing timestamps."""

    def __init__(self, source_cfg: Dict, cfg: Dict, model_paths: Dict[str, Path]):
        from .trackers import FaceTracker, HandTracker

        trackers = set(source_cfg.get("trackers") or [])
        self.hands_cfg = cfg.get("hands", {})
        self.face_cfg = cfg.get("face", {})
        self.hands = HandTracker(model_paths["hand"], self.hands_cfg) if "hands" in trackers else None
        self.face = FaceTracker(model_paths["face"], self.face_cfg) if "face" in trackers else None
        self.use_body = "body" in trackers
        self.process_width = int(source_cfg.get("process_width", 0) or 0)
        self.pinch_threshold = float(self.hands_cfg.get("pinch_threshold", 0.28))
        smoothing = float(cfg.get("head", {}).get("smoothing", 1.5))
        self._head_filters = [OneEuroFilter(smoothing, 0.03) for _ in range(3)]
        self.neutral = HeadPose(0.0, 0.0, 0.0)
        self._raw_head: Optional[HeadPose] = None
        self._calibrate = False
        self._last_ts = -1

    def request_calibration(self) -> None:
        """Make the next observed head pose the neutral (0, 0, 0) pose."""
        self._calibrate = True

    def _timestamp_ms(self, t: float) -> int:
        ts = max(self._last_ts + 1, int(t * 1000))
        self._last_ts = ts
        return ts

    def process(self, frame: Frame) -> Observation:
        import mediapipe as mp

        obs = Observation(source=frame.source, frame=frame, bodies=frame.bodies if self.use_body else [])
        if self.hands is None and self.face is None:
            return obs
        image = frame.image
        h, w = image.shape[:2]
        if self.process_width and w > self.process_width:
            scale = self.process_width / w
            image = cv2.resize(image, (self.process_width, int(round(h * scale))), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = self._timestamp_ms(frame.timestamp)

        if self.hands is not None:
            obs.hands = self._hands(mp_image, ts, frame, w, h)
        if self.face is not None:
            obs.faces = self._faces(mp_image, ts, frame, w, h)
        return obs

    def _hands(self, mp_image, ts, frame: Frame, w: int, h: int):
        hands = self.hands.process(mp_image, ts)
        max_depth = float(self.hands_cfg.get("max_depth_mm", 0) or 0)
        kept = []
        for hand in hands:
            cx, cy = hand.palm_center()
            hand.depth_mm = depth_at(frame.depth, float(cx), float(cy))
            if max_depth and hand.depth_mm and hand.depth_mm > max_depth:
                continue
            points = hand.world if hand.world is not None else hand.landmarks * np.array([w, h, w])
            result = classify(points, hand.landmarks, self.pinch_threshold)
            hand.pose, hand.fingers, hand.finger_count, hand.pinch = (
                result.pose, result.fingers, result.count, result.pinch)
            kept.append(hand)
        return kept

    def _faces(self, mp_image, ts, frame: Frame, w: int, h: int):
        faces = []
        max_depth = float(self.face_cfg.get("max_depth_mm", 0) or 0)
        for landmarks, blend in self.face.process(mp_image, ts):
            nose = landmarks[NOSE_TIP]
            depth = depth_at(frame.depth, float(nose[0]), float(nose[1]))
            if max_depth and depth and depth > max_depth:
                continue
            raw = head_pose(landmarks, w, h)
            if not faces:  # smooth + calibrate the primary face only
                raw = self._smooth(raw, frame.timestamp)
                self._raw_head = raw
                if self._calibrate:
                    self.neutral = raw
                    self._calibrate = False
                    log.info("%s: head pose calibrated (yaw %.1f, pitch %.1f, roll %.1f)",
                             frame.source, raw.yaw, raw.pitch, raw.roll)
                pose = HeadPose(raw.yaw - self.neutral.yaw, raw.pitch - self.neutral.pitch,
                                raw.roll - self.neutral.roll)
            else:
                pose = raw
            faces.append(Face(landmarks=landmarks, head=pose, metrics=face_metrics(landmarks, w, h, blend),
                              blendshapes=blend, depth_mm=depth))
        if not faces:
            for f in self._head_filters:
                f.reset()
        return faces

    def _smooth(self, pose: HeadPose, t: float) -> HeadPose:
        fy, fp, fr = self._head_filters
        return HeadPose(fy(pose.yaw, t), fp(pose.pitch, t), fr(pose.roll, t))

    def close(self) -> None:
        for tracker in (self.hands, self.face):
            if tracker is not None:
                try:
                    tracker.close()
                except Exception:  # pragma: no cover
                    pass
