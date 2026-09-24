"""Plain data containers passed between sources, perception, gestures and actions.

Coordinate conventions used everywhere in this package:

* Images are BGR ``uint8`` and are *mirror view* (like looking in a mirror) once
  they leave a source; each source has a ``mirror`` option to get there.  In a
  mirror view "left"/"right" in the image are the user's own left/right, which is
  also what MediaPipe's handedness classifier assumes.
* Normalised landmark coordinates: ``x`` and ``y`` in ``[0, 1]`` relative to the
  image width/height, ``z`` is MediaPipe's relative depth (same scale as ``x``).
* Depth values are millimetres from the Kinect sensor, ``0`` meaning "unknown".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Event phases
TRIGGER = "trigger"  # momentary gesture (swipe, nod, blink ...)
START = "start"      # a held gesture/pose became active
END = "end"          # a held gesture/pose stopped


@dataclass
class Joint:
    """A skeleton joint reported natively by the Kinect SDK."""

    name: str
    position: Tuple[float, float, float]      # camera space, metres
    pixel: Optional[Tuple[float, float]]      # colour image pixel (after mirroring)
    tracked: bool                             # False when the SDK only inferred it


@dataclass
class Body:
    """A tracked person from the Kinect v2 body stream."""

    tracking_id: int
    joints: Dict[str, Joint]
    hand_states: Dict[str, str]               # {"left"|"right": "open"|"closed"|"lasso"|"unknown"}


@dataclass
class Frame:
    source: str
    image: np.ndarray                         # BGR uint8, mirror view
    timestamp: float                          # time.monotonic() seconds
    index: int
    depth: Optional[np.ndarray] = None        # float32 mm, same HxW as ``image``
    bodies: List[Body] = field(default_factory=list)

    @property
    def size(self) -> Tuple[int, int]:
        h, w = self.image.shape[:2]
        return w, h


@dataclass
class Hand:
    side: str                                 # "left" | "right" (user's own hand)
    score: float
    landmarks: np.ndarray                     # (21, 3) normalised image coords
    world: Optional[np.ndarray] = None        # (21, 3) metres, hand-centred
    depth_mm: Optional[float] = None          # palm distance from the Kinect
    pose: Optional[str] = None                # static pose name, see gestures.hand_pose
    fingers: Dict[str, bool] = field(default_factory=dict)
    finger_count: int = 0
    pinch: float = 1.0                        # thumb-index distance / palm size

    def palm_center(self) -> np.ndarray:
        return self.landmarks[[0, 5, 9, 13, 17], :2].mean(axis=0)


@dataclass
class HeadPose:
    yaw: float                                # + = face turned to the user's right
    pitch: float                              # + = looking up
    roll: float                               # + = head tilted to the user's right

    def as_dict(self) -> Dict[str, float]:
        return {"yaw": self.yaw, "pitch": self.pitch, "roll": self.roll}


@dataclass
class Face:
    landmarks: np.ndarray                     # (478, 3) normalised image coords
    head: HeadPose
    metrics: Dict[str, float]                 # eye_left, eye_right, mouth_open, smile, brows_up ...
    blendshapes: Dict[str, float] = field(default_factory=dict)
    depth_mm: Optional[float] = None


@dataclass
class GestureEvent:
    name: str                                 # e.g. "SWIPE_LEFT", "FIST", "NOD", "SMILE"
    category: str                             # "hand" | "face" | "head" | "body"
    phase: str                                # TRIGGER | START | END
    source: str
    timestamp: float
    side: Optional[str] = None                # "left"/"right" for hand & body gestures
    data: Dict[str, Any] = field(default_factory=dict)

    def label(self) -> str:
        side = f" {self.side}" if self.side else ""
        phase = "" if self.phase == TRIGGER else f" ({self.phase})"
        return f"{self.name}{side}{phase} [{self.source}]"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "event",
            "name": self.name,
            "category": self.category,
            "phase": self.phase,
            "source": self.source,
            "side": self.side,
            "timestamp": self.timestamp,
            "data": self.data,
        }


@dataclass
class Observation:
    """Everything one source worker produced for one frame."""

    source: str
    frame: Frame
    hands: List[Hand] = field(default_factory=list)
    faces: List[Face] = field(default_factory=list)
    bodies: List[Body] = field(default_factory=list)
    events: List[GestureEvent] = field(default_factory=list)
    fps: float = 0.0
    latency_ms: float = 0.0

    def hand(self, side: str) -> Optional[Hand]:
        for h in self.hands:
            if h.side == side:
                return h
        return None

    def to_dict(self) -> Dict[str, Any]:
        w, h = self.frame.size
        return {
            "type": "tracking",
            "source": self.source,
            "timestamp": self.frame.timestamp,
            "frame": self.frame.index,
            "size": [w, h],
            "fps": round(self.fps, 1),
            "hands": [
                {
                    "side": hd.side,
                    "score": round(hd.score, 3),
                    "pose": hd.pose,
                    "fingers": hd.fingers,
                    "finger_count": hd.finger_count,
                    "depth_mm": hd.depth_mm,
                    "landmarks": np.round(hd.landmarks, 4).tolist(),
                }
                for hd in self.hands
            ],
            "faces": [
                {
                    "head": {k: round(v, 2) for k, v in f.head.as_dict().items()},
                    "metrics": {k: round(v, 3) for k, v in f.metrics.items()},
                    "depth_mm": f.depth_mm,
                }
                for f in self.faces
            ],
            "bodies": [
                {
                    "tracking_id": b.tracking_id,
                    "hand_states": b.hand_states,
                    "joints": {n: list(j.position) for n, j in b.joints.items()},
                }
                for b in self.bodies
            ],
        }
