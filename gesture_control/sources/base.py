"""Threaded frame sources.

A capture thread keeps only the newest frame so slow tracking never builds up
latency; ``read()`` hands out each frame at most once.  File sources are the
exception: they are *lossless* (every frame is processed, paced to the video's
frame rate) so recorded clips behave the same on every run.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np

from ..types import Body, Frame, Joint

log = logging.getLogger(__name__)

Grabbed = Tuple[np.ndarray, Optional[np.ndarray], List[Body]]


class SourceError(RuntimeError):
    """A camera could not be opened or stopped delivering frames."""


class EndOfStream(Exception):
    """Raised by ``_grab`` when a video file is finished."""


class FrameSource:
    lossless = False
    max_failures = 60

    def __init__(self, name: str, cfg: dict):
        self.name = name
        self.cfg = cfg
        self.mirror = bool(cfg.get("mirror", False))
        self.finished = False
        self.error: Optional[str] = None
        self._cond = threading.Condition()
        self._latest: Optional[Frame] = None
        self._returned = -1
        self._index = 0
        self._running = False
        self._thread: Optional[threading.Thread] = None

    # -- subclass API ----------------------------------------------------
    def _open(self) -> None:
        raise NotImplementedError

    def _grab(self) -> Optional[Grabbed]:
        """Block until the next frame; return None on a transient failure."""
        raise NotImplementedError

    def _close(self) -> None:
        pass

    def _timestamp(self) -> float:
        return time.monotonic()

    def describe(self) -> str:
        return self.name

    # -- public ----------------------------------------------------------
    def start(self) -> None:
        self._open()
        self._running = True
        self._thread = threading.Thread(target=self._loop, name=f"capture-{self.name}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        with self._cond:
            self._cond.notify_all()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        try:
            self._close()
        except Exception as exc:  # pragma: no cover - driver specific
            log.debug("closing %s: %s", self.name, exc)

    def read(self, timeout: float = 1.0) -> Optional[Frame]:
        """Return the newest frame not returned before, or None on timeout/end."""
        with self._cond:
            ready = self._cond.wait_for(
                lambda: (self._latest is not None and self._latest.index != self._returned)
                or not self._running or self.finished,
                timeout=timeout,
            )
            if not ready or self._latest is None or self._latest.index == self._returned:
                return None
            frame = self._latest
            self._returned = frame.index
            self._cond.notify_all()
            return frame

    # -- internals -------------------------------------------------------
    def _loop(self) -> None:
        failures = 0
        last_frame = time.monotonic()
        warned_at = last_frame
        while self._running:
            try:
                grabbed = self._grab()
            except EndOfStream:
                log.info("%s: end of stream", self.name)
                break
            except Exception as exc:
                grabbed = None
                log.debug("%s: grab failed: %s", self.name, exc)
            if grabbed is None:
                failures += 1
                now = time.monotonic()
                if now - last_frame > 5 and now - warned_at > 5:
                    log.warning("%s: no frames for %.0f s", self.name, now - last_frame)
                    warned_at = now
                if failures >= self.max_failures and now - last_frame > 10:
                    self.error = "stopped delivering frames"
                    log.error("%s: giving up, camera stopped delivering frames", self.name)
                    break
                time.sleep(0.01)
                continue
            failures = 0
            last_frame = time.monotonic()
            image, depth, bodies = grabbed
            if self.mirror:
                image, depth, bodies = mirror_frame(image, depth, bodies)
            frame = Frame(
                source=self.name,
                image=image,
                timestamp=self._timestamp(),
                index=self._index,
                depth=depth,
                bodies=bodies,
            )
            self._index += 1
            with self._cond:
                if self.lossless:
                    self._cond.wait_for(
                        lambda: self._latest is None or self._latest.index == self._returned
                        or not self._running
                    )
                self._latest = frame
                self._cond.notify_all()
        with self._cond:
            self.finished = True
            self._cond.notify_all()


def mirror_frame(image: np.ndarray, depth: Optional[np.ndarray], bodies: List[Body]) -> Grabbed:
    """Flip a frame horizontally, including depth and skeleton pixel coordinates."""
    w = image.shape[1]
    image = cv2.flip(image, 1)
    if depth is not None:
        depth = cv2.flip(depth, 1)
    flipped = []
    for body in bodies:
        joints = {
            name: Joint(j.name, j.position, (w - 1 - j.pixel[0], j.pixel[1]) if j.pixel else None, j.tracked)
            for name, j in body.joints.items()
        }
        flipped.append(Body(body.tracking_id, joints, dict(body.hand_states)))
    return image, depth, flipped
