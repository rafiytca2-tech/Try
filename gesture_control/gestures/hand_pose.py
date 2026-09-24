"""Rule-based static hand-pose classification from 21 MediaPipe hand landmarks.

Finger states use a straightness ratio measured on the metric 3D "world"
landmarks, so they do not depend on hand size or how the hand is rotated.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np

WRIST = 0
THUMB = (1, 2, 3, 4)
FINGERS = {
    "index": (5, 6, 7, 8),
    "middle": (9, 10, 11, 12),
    "ring": (13, 14, 15, 16),
    "pinky": (17, 18, 19, 20),
}
FINGER_ORDER = ("thumb", "index", "middle", "ring", "pinky")


@dataclass
class PoseResult:
    pose: Optional[str]
    fingers: Dict[str, bool]
    count: int
    pinch: float  # thumb-tip to index-tip distance / palm size


def _angle(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.degrees(np.arccos(np.clip(np.dot(a, b) / (na * nb), -1.0, 1.0))))


def chain_bend(p: np.ndarray, idx) -> float:
    """Total bend (degrees) along a 4-joint chain, measured at its two middle joints."""
    j0, j1, j2, j3 = (p[i] for i in idx)
    return _angle(j1 - j0, j2 - j1) + _angle(j2 - j1, j3 - j2)


def straightness(p: np.ndarray, idx) -> float:
    """Wrist-to-fingertip distance divided by the path length along the finger.

    1.0 for a finger in line with the palm, ~0.3-0.7 when curled.  Being a
    ratio it is independent of hand size, distance and rotation.
    """
    chain = [p[WRIST]] + [p[i] for i in idx]
    path = sum(float(np.linalg.norm(b - a)) for a, b in zip(chain, chain[1:]))
    if path < 1e-9:
        return 0.0
    return float(np.linalg.norm(chain[-1] - chain[0]) / path)


def finger_extended(p: np.ndarray, idx, threshold: float = 0.76) -> bool:
    return straightness(p, idx) > threshold


def thumb_extended(p: np.ndarray, palm: float) -> bool:
    # A tucked thumb ends near the index/middle knuckles; an extended one does not.
    straight = float(np.linalg.norm(p[4] - p[1])) > 0.85 * sum(
        float(np.linalg.norm(p[b] - p[a])) for a, b in ((1, 2), (2, 3), (3, 4))
    )
    away = np.linalg.norm(p[4] - p[9]) > 0.8 * palm and np.linalg.norm(p[4] - p[5]) > 0.5 * palm
    return bool(straight and away)


def thumb_direction(lm: np.ndarray) -> Optional[str]:
    """'up'/'down' when the thumb clearly points vertically in the image."""
    v = lm[4, :2] - lm[2, :2]
    if abs(v[1]) < 1.5 * abs(v[0]):
        return None
    ys = lm[:, 1]
    if v[1] < 0 and lm[4, 1] <= ys.min() + 1e-6:
        return "up"
    if v[1] > 0 and lm[4, 1] >= ys.max() - 1e-6:
        return "down"
    return None


def classify(points: np.ndarray, image_lm: np.ndarray, pinch_threshold: float = 0.28) -> PoseResult:
    """Classify a hand.

    ``points``: (21, 3) metric world landmarks (or pixel-scaled image landmarks).
    ``image_lm``: (21, 3) normalised image landmarks (for up/down in the image).
    """
    p = np.asarray(points, dtype=np.float64)
    palm = float(np.linalg.norm(p[9] - p[WRIST])) or 1e-6
    fingers = {name: finger_extended(p, idx) for name, idx in FINGERS.items()}
    fingers = {"thumb": thumb_extended(p, palm), **fingers}
    pinch = float(np.linalg.norm(p[4] - p[8]) / palm)
    count = sum(fingers.values())
    t, i, m, r, k = (fingers[n] for n in FINGER_ORDER)

    pose: Optional[str] = None
    if pinch < pinch_threshold and not i:
        pose = "OK" if (m and r and k) else "PINCH"
    elif pinch < pinch_threshold and i and not (m or r or k):
        pose = "PINCH"  # index still counts as straight when pinching lightly
    elif not (i or m or r or k):
        direction = thumb_direction(image_lm) if t else None
        pose = {"up": "THUMBS_UP", "down": "THUMBS_DOWN"}.get(direction, "FIST")
    elif i and not (m or r or k):
        pose = "POINT"
    elif i and m and not (r or k):
        pose = "VICTORY"
    elif i and m and r and not k:
        pose = "THREE"
    elif i and m and r and k:
        pose = "OPEN_PALM" if t else "FOUR"
    elif i and k and not (m or r):
        pose = "ROCK"
    elif k and t and not (i or m or r):
        pose = "CALL_ME"
    elif (m and r and k) and not i and pinch < 1.5 * pinch_threshold:
        pose = "OK"
    return PoseResult(pose, fingers, count, pinch)
