"""Preview window rendering."""

from __future__ import annotations

import math
import time
from typing import Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

from .sources.kinect_v2 import BONES
from .types import Observation

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10),
    (10, 11), (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18),
    (18, 19), (19, 20), (0, 17),
]
SIDE_COLORS = {"left": (255, 170, 60), "right": (60, 200, 255)}   # BGR
HAND_STATE_COLORS = {"open": (80, 220, 80), "closed": (60, 60, 230), "lasso": (230, 120, 60)}
WHITE, BLACK, GREY = (255, 255, 255), (0, 0, 0), (150, 150, 150)
FONT = cv2.FONT_HERSHEY_SIMPLEX


def _face_connections():
    try:
        from mediapipe.tasks.python.vision import FaceLandmarksConnections as C

        groups = [C.FACE_LANDMARKS_FACE_OVAL, C.FACE_LANDMARKS_LEFT_EYE, C.FACE_LANDMARKS_RIGHT_EYE,
                  C.FACE_LANDMARKS_LEFT_EYEBROW, C.FACE_LANDMARKS_RIGHT_EYEBROW, C.FACE_LANDMARKS_LIPS]
        return [(c.start, c.end) for g in groups for c in g]
    except Exception:
        return None


_FACE_EDGES = None


def text(img, s: str, org: Tuple[int, int], scale: float = 0.5, color=WHITE, thickness: int = 1) -> None:
    # Outline via offset copies: a thicker stroke would also widen glyph advances
    # with OpenCV 5's font renderer and misalign the two layers.
    x, y = org
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)):
        cv2.putText(img, s, (x + dx, y + dy), FONT, scale, BLACK, thickness, cv2.LINE_AA)
    cv2.putText(img, s, org, FONT, scale, color, thickness, cv2.LINE_AA)


def depth_colormap(depth: np.ndarray, size: Tuple[int, int], near: float = 500, far: float = 4500) -> np.ndarray:
    d = cv2.resize(depth, size, interpolation=cv2.INTER_NEAREST)
    norm = np.clip((d - near) / (far - near), 0, 1)
    img = cv2.applyColorMap((255 - norm * 255).astype(np.uint8), cv2.COLORMAP_JET)
    img[d <= 0] = 0
    return img


def draw_observation(obs: Observation, height: int, show_depth: bool = False,
                     show_mesh: bool = True) -> np.ndarray:
    global _FACE_EDGES
    frame = obs.frame
    h0, w0 = frame.image.shape[:2]
    scale = height / h0
    w = int(round(w0 * scale))
    img = cv2.resize(frame.image, (w, height), interpolation=cv2.INTER_AREA)
    if show_depth and frame.depth is not None:
        img = cv2.addWeighted(img, 0.45, depth_colormap(frame.depth, (w, height)), 0.55, 0)
    size = np.array([w, height], dtype=np.float32)

    for body in obs.bodies:
        pts = {n: (int(j.pixel[0] * scale), int(j.pixel[1] * scale))
               for n, j in body.joints.items() if j.pixel is not None}
        for a, b in BONES:
            if a in pts and b in pts:
                cv2.line(img, pts[a], pts[b], (200, 200, 200), 2, cv2.LINE_AA)
        for side, joint in (("left", "HandLeft"), ("right", "HandRight")):
            if joint in pts:
                state = body.hand_states.get(side, "unknown")
                cv2.circle(img, pts[joint], 14, HAND_STATE_COLORS.get(state, GREY), 3, cv2.LINE_AA)

    for face in obs.faces:
        pts = (face.landmarks[:, :2] * size).astype(np.int32)
        if show_mesh:
            if _FACE_EDGES is None:
                _FACE_EDGES = _face_connections() or []
            if _FACE_EDGES:
                for a, b in _FACE_EDGES:
                    cv2.line(img, tuple(pts[a]), tuple(pts[b]), (180, 230, 180), 1, cv2.LINE_AA)
            else:
                for p in pts[::3]:
                    cv2.circle(img, tuple(p), 1, (180, 230, 180), -1)
        nose = pts[1]
        hp = face.head
        length = 0.25 * height
        tip = (int(nose[0] + length * math.sin(math.radians(hp.yaw))),
               int(nose[1] - length * math.sin(math.radians(hp.pitch))))
        cv2.arrowedLine(img, tuple(nose), tip, (0, 255, 255), 2, cv2.LINE_AA, tipLength=0.2)
        top = pts[:, 1].min()
        left = pts[:, 0].min()
        text(img, f"yaw {hp.yaw:+.0f}  pitch {hp.pitch:+.0f}  roll {hp.roll:+.0f}",
             (int(left), max(15, int(top) - 10)), 0.45, (0, 255, 255))

    for hand in obs.hands:
        pts = (hand.landmarks[:, :2] * size).astype(np.int32)
        color = SIDE_COLORS.get(hand.side, WHITE)
        for a, b in HAND_CONNECTIONS:
            cv2.line(img, tuple(pts[a]), tuple(pts[b]), color, 2, cv2.LINE_AA)
        for p in pts:
            cv2.circle(img, tuple(p), 3, WHITE, -1, cv2.LINE_AA)
        label = f"{hand.side[0].upper()}: {hand.pose or '-'} ({hand.finger_count})"
        if hand.depth_mm:
            label += f" {hand.depth_mm / 1000:.2f}m"
        x, y = pts[:, 0].min(), pts[:, 1].max() + 18
        text(img, label, (int(x), int(min(height - 5, y))), 0.5, color)

    if obs.faces:
        _draw_meters(img, obs.faces[0].metrics)
    text(img, f"{obs.source}  {obs.fps:4.1f} fps  {obs.latency_ms:3.0f} ms", (8, 20), 0.55)
    return img


def _draw_meters(img: np.ndarray, metrics) -> None:
    items = [("smile", "smile"), ("mouth", "mouth_open"), ("brows", "brows_up"),
             ("eye L", "eye_left"), ("eye R", "eye_right")]
    x0, y0 = img.shape[1] - 130, 14
    for i, (label, key) in enumerate(items):
        y = y0 + i * 16
        v = float(np.clip(metrics.get(key, 0.0), 0, 1))
        cv2.rectangle(img, (x0 + 48, y - 9), (x0 + 118, y + 1), (60, 60, 60), -1)
        cv2.rectangle(img, (x0 + 48, y - 9), (x0 + 48 + int(70 * v), y + 1), (80, 220, 80), -1)
        text(img, label, (x0, y), 0.4)


def placeholder(name: str, message: str, height: int) -> np.ndarray:
    w = int(height * 16 / 9)
    img = np.full((height, w, 3), 30, np.uint8)
    text(img, name, (12, 28), 0.7)
    for i, line in enumerate(message.splitlines()[:8]):
        text(img, line[:90], (12, 60 + 22 * i), 0.45, GREY)
    return img


def compose(panels: Sequence[np.ndarray], events: Iterable[Tuple[float, str]], status: List[str],
            now: Optional[float] = None, max_events: int = 6) -> np.ndarray:
    """Place camera panels side by side with a status + recent-events strip underneath."""
    if not panels:
        panels = [np.zeros((360, 640, 3), np.uint8)]
    top = np.hstack(panels) if len(panels) > 1 else panels[0]
    strip_h = 16 + 20 * len(status) + 18 * max_events + 10
    strip = np.full((strip_h, top.shape[1], 3), 24, np.uint8)
    for i, line in enumerate(status):
        text(strip, line, (10, 22 + 20 * i), 0.5, (0, 230, 255) if i == 0 else WHITE)
    now = time.monotonic() if now is None else now
    y0 = 22 + 20 * len(status) + 4
    for i, (t, line) in enumerate(list(events)[-max_events:][::-1]):
        shade = int(np.clip(255 - (now - t) * 25, 110, 255))
        text(strip, line[:120], (10, y0 + 18 * i), 0.45, (shade, shade, shade))
    return np.vstack([top, strip])
