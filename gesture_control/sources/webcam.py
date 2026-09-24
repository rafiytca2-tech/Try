"""Webcams, video files and network streams through OpenCV."""

from __future__ import annotations

import logging
import os
import sys
import time
from typing import Optional, Union

import cv2

from .base import EndOfStream, FrameSource, Grabbed, SourceError

log = logging.getLogger(__name__)

APIS = {
    "any": cv2.CAP_ANY,
    "dshow": getattr(cv2, "CAP_DSHOW", cv2.CAP_ANY),
    "msmf": getattr(cv2, "CAP_MSMF", cv2.CAP_ANY),
    "v4l2": getattr(cv2, "CAP_V4L2", cv2.CAP_ANY),
    "avfoundation": getattr(cv2, "CAP_AVFOUNDATION", cv2.CAP_ANY),
    "gstreamer": getattr(cv2, "CAP_GSTREAMER", cv2.CAP_ANY),
    "ffmpeg": getattr(cv2, "CAP_FFMPEG", cv2.CAP_ANY),
}


def parse_device(device: Union[int, str]) -> Union[int, str]:
    if isinstance(device, int):
        return device
    text = str(device).strip()
    return int(text) if text.lstrip("-").isdigit() else text


def open_capture(device: Union[int, str], api: str = "auto", width: int = 0, height: int = 0,
                 fps: float = 0, fourcc: str = "") -> cv2.VideoCapture:
    device = parse_device(device)
    if api == "auto":
        # DirectShow opens faster and honours resolution requests better on Windows.
        api = "dshow" if (sys.platform == "win32" and isinstance(device, int)) else "any"
    cap = cv2.VideoCapture(device, APIS.get(api, cv2.CAP_ANY))
    if not cap.isOpened() and api != "any":
        cap = cv2.VideoCapture(device)
    if not cap.isOpened():
        raise SourceError(f"could not open camera/video {device!r}")
    if isinstance(device, int):
        if fourcc:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*fourcc[:4]))
        if width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if fps:
            cap.set(cv2.CAP_PROP_FPS, fps)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap


class WebcamSource(FrameSource):
    """``device`` may be a camera index, a video file path or a stream URL."""

    def __init__(self, name: str, cfg: dict):
        super().__init__(name, cfg)
        self.device = parse_device(cfg.get("device", 0))
        self.is_file = isinstance(self.device, str) and os.path.isfile(self.device)
        self.lossless = self.is_file
        self.loop = bool(cfg.get("loop", False))
        self.cap: Optional[cv2.VideoCapture] = None
        self._file_fps = 30.0
        self._t0 = 0.0
        self._n = 0

    def describe(self) -> str:
        if self.cap is None:
            return f"{self.name} ({self.device})"
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        kind = "file" if self.is_file else "camera"
        return f"{self.name}: {kind} {self.device} {w}x{h}"

    def _open(self) -> None:
        cfg = self.cfg
        self.cap = open_capture(
            self.device, cfg.get("api", "auto"), int(cfg.get("width", 0) or 0),
            int(cfg.get("height", 0) or 0), float(cfg.get("fps", 0) or 0), str(cfg.get("fourcc", "") or ""),
        )
        if self.is_file:
            self._file_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
            if not 1 <= self._file_fps <= 240:
                self._file_fps = 30.0
        self._t0 = time.monotonic()
        log.info("Opened %s", self.describe())

    def _timestamp(self) -> float:
        if self.is_file:  # video time, so gesture timing does not depend on processing speed
            return self._t0 + (self._n - 1) / self._file_fps
        return time.monotonic()

    def _grab(self) -> Optional[Grabbed]:
        ok, image = self.cap.read()
        if not ok or image is None:
            if self.is_file:
                if self.loop:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    return None
                raise EndOfStream()
            return None
        if self.is_file:
            self._n += 1
            if self.cfg.get("realtime", True):
                due = self._t0 + (self._n - 1) / self._file_fps
                delay = due - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
        return image, None, []

    def _close(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None
