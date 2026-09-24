"""Thin wrappers around the MediaPipe Tasks hand and face landmarkers."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from ..types import Hand

log = logging.getLogger(__name__)


def _vision():
    from mediapipe.tasks.python import BaseOptions, vision

    return BaseOptions, vision


def to_array(landmarks) -> np.ndarray:
    return np.array([[p.x, p.y, p.z] for p in landmarks], dtype=np.float32)


def resolve_sides(hands: List[Hand]) -> List[Hand]:
    """MediaPipe occasionally labels both hands the same; relabel the weaker one."""
    if len(hands) == 2 and hands[0].side == hands[1].side:
        weaker = min(hands, key=lambda h: h.score)
        weaker.side = "left" if weaker.side == "right" else "right"
    return hands


class HandTracker:
    def __init__(self, model_path: Path, cfg: Dict):
        BaseOptions, vision = _vision()
        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=int(cfg.get("max_hands", 2)),
            min_hand_detection_confidence=float(cfg.get("min_detection_confidence", 0.6)),
            min_hand_presence_confidence=float(cfg.get("min_presence_confidence", 0.5)),
            min_tracking_confidence=float(cfg.get("min_tracking_confidence", 0.5)),
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)

    def process(self, image, timestamp_ms: int) -> List[Hand]:
        result = self._landmarker.detect_for_video(image, timestamp_ms)
        hands = []
        for i, landmarks in enumerate(result.hand_landmarks):
            category = result.handedness[i][0]
            world = None
            if result.hand_world_landmarks and i < len(result.hand_world_landmarks):
                world = to_array(result.hand_world_landmarks[i])
            hands.append(Hand(
                side=category.category_name.lower(),
                score=float(category.score),
                landmarks=to_array(landmarks),
                world=world,
            ))
        return resolve_sides(hands)

    def close(self) -> None:
        self._landmarker.close()


class FaceTracker:
    def __init__(self, model_path: Path, cfg: Dict):
        BaseOptions, vision = _vision()
        options = vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=int(cfg.get("max_faces", 1)),
            min_face_detection_confidence=float(cfg.get("min_detection_confidence", 0.5)),
            min_face_presence_confidence=float(cfg.get("min_presence_confidence", 0.5)),
            min_tracking_confidence=float(cfg.get("min_tracking_confidence", 0.5)),
            output_face_blendshapes=True,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(options)

    def process(self, image, timestamp_ms: int) -> List[Tuple[np.ndarray, Dict[str, float]]]:
        result = self._landmarker.detect_for_video(image, timestamp_ms)
        faces = []
        for i, landmarks in enumerate(result.face_landmarks):
            blend = {}
            if result.face_blendshapes and i < len(result.face_blendshapes):
                blend = {c.category_name: float(c.score) for c in result.face_blendshapes[i]}
            faces.append((to_array(landmarks), blend))
        return faces

    def close(self) -> None:
        self._landmarker.close()
