from .base import EndOfStream, FrameSource, SourceError, mirror_frame
from .kinect_v2 import KinectV2Source
from .webcam import WebcamSource


def create_source(name: str, cfg: dict) -> FrameSource:
    kind = cfg.get("type", "webcam")
    if kind == "webcam":
        return WebcamSource(name, cfg)
    if kind == "kinect_v2":
        return KinectV2Source(name, cfg)
    raise SourceError(f"{name}: unknown source type {kind!r}")


__all__ = [
    "EndOfStream", "FrameSource", "KinectV2Source", "SourceError", "WebcamSource",
    "create_source", "mirror_frame",
]
