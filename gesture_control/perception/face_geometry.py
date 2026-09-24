"""Head pose and facial measurements from MediaPipe face landmarks (pure maths)."""

from __future__ import annotations

import math
from typing import Dict, Optional

import numpy as np

from ..types import HeadPose

# MediaPipe face-mesh landmark indices.  "img_left" means the eye that appears
# on the left of the image, which is the user's left eye in a mirror view.
NOSE_TIP = 1
FOREHEAD = 10
CHIN = 152
EYE_IMG_LEFT = (33, 160, 158, 133, 153, 144)    # outer, upper x2, inner, lower x2
EYE_IMG_RIGHT = (263, 387, 385, 362, 380, 373)
MOUTH_TOP, MOUTH_BOTTOM, MOUTH_LEFT, MOUTH_RIGHT = 13, 14, 78, 308


def _pixels(lm: np.ndarray, width: int, height: int) -> np.ndarray:
    """Normalised landmarks -> pixel units (z uses the x scale, as MediaPipe does)."""
    return lm[:, :3] * np.array([width, height, width], dtype=np.float64)


def head_pose(lm: np.ndarray, width: int, height: int) -> HeadPose:
    """Yaw/pitch/roll in degrees from the face's own axes.

    ``r`` runs from the image-left eye corner to the image-right one, ``d`` from
    forehead to chin; their cross product is the face normal pointing out of the
    face (toward the camera when frontal).  In image axes (x right, y down, z
    away from the camera):

    * yaw   > 0: face turned toward the image right  (user's right in mirror view)
    * pitch > 0: looking up
    * roll  > 0: head tilted toward the image right   (user's right in mirror view)
    """
    p = _pixels(lm, width, height)
    r = p[EYE_IMG_RIGHT[0]] - p[EYE_IMG_LEFT[0]]
    d = p[CHIN] - p[FOREHEAD]
    n = np.cross(d, r)
    norm = np.linalg.norm(n)
    if norm < 1e-9:
        return HeadPose(0.0, 0.0, 0.0)
    n /= norm
    yaw = math.degrees(math.atan2(n[0], -n[2]))
    pitch = math.degrees(math.asin(float(np.clip(-n[1], -1.0, 1.0))))
    roll = math.degrees(math.atan2(r[1], r[0]))
    return HeadPose(yaw, pitch, roll)


def eye_aspect_ratio(p: np.ndarray, idx) -> float:
    outer, up1, up2, inner, low2, low1 = (p[i, :2] for i in idx)
    width = np.linalg.norm(outer - inner)
    if width < 1e-9:
        return 0.0
    return float((np.linalg.norm(up1 - low1) + np.linalg.norm(up2 - low2)) / (2.0 * width))


def mouth_aspect_ratio(p: np.ndarray) -> float:
    width = np.linalg.norm(p[MOUTH_LEFT, :2] - p[MOUTH_RIGHT, :2])
    if width < 1e-9:
        return 0.0
    return float(np.linalg.norm(p[MOUTH_TOP, :2] - p[MOUTH_BOTTOM, :2]) / width)


def _ramp(value: float, lo: float, hi: float) -> float:
    return float(np.clip((value - lo) / (hi - lo), 0.0, 1.0))


def face_metrics(lm: np.ndarray, width: int, height: int,
                 blendshapes: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    """0..1 scores: eye_left / eye_right (closure), mouth_open, smile, brows_up.

    ``eye_left`` is the eye on the image's left (the user's left in mirror view).
    Blendshape names alone are ambiguous about image side, so the eye aspect
    ratio decides which eye is the more closed one and the blendshapes supply
    the magnitudes.
    """
    p = _pixels(lm, width, height)
    ear_l = eye_aspect_ratio(p, EYE_IMG_LEFT)
    ear_r = eye_aspect_ratio(p, EYE_IMG_RIGHT)
    mar = mouth_aspect_ratio(p)
    bs = blendshapes or {}
    if "eyeBlinkLeft" in bs and "eyeBlinkRight" in bs:
        hi = max(bs["eyeBlinkLeft"], bs["eyeBlinkRight"])
        lo = min(bs["eyeBlinkLeft"], bs["eyeBlinkRight"])
        eye_l, eye_r = (hi, lo) if ear_l <= ear_r else (lo, hi)
    else:
        eye_l = 1.0 - _ramp(ear_l, 0.12, 0.26)
        eye_r = 1.0 - _ramp(ear_r, 0.12, 0.26)
    if "jawOpen" in bs:
        mouth = bs["jawOpen"]
    else:
        mouth = _ramp(mar, 0.08, 0.55)
    smile = (bs.get("mouthSmileLeft", 0.0) + bs.get("mouthSmileRight", 0.0)) / 2.0
    brows = max(bs.get("browInnerUp", 0.0),
                (bs.get("browOuterUpLeft", 0.0) + bs.get("browOuterUpRight", 0.0)) / 2.0)
    return {
        "eye_left": float(eye_l),
        "eye_right": float(eye_r),
        "mouth_open": float(mouth),
        "smile": float(smile),
        "brows_up": float(brows),
        "ear_left": ear_l,
        "ear_right": ear_r,
        "mar": mar,
    }
