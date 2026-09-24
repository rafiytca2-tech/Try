"""Locating and downloading the MediaPipe model files."""

from __future__ import annotations

import logging
import os
import shutil
import urllib.request
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

MODELS = {
    "hand": (
        "hand_landmarker.task",
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
    ),
    "face": (
        "face_landmarker.task",
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    ),
}


def models_dir(configured: Optional[str] = None) -> Path:
    if configured:
        return Path(configured).expanduser()
    env = os.environ.get("GESTURE_CONTROL_MODELS")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".cache" / "gesture_control" / "models"


def ensure_model(kind: str, directory: Path) -> Path:
    """Return the local path of a model, downloading it on first use."""
    filename, url = MODELS[kind]
    path = Path(directory) / filename
    if path.is_file() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    log.info("Downloading %s model (one time) -> %s", kind, path)
    try:
        with urllib.request.urlopen(url, timeout=60) as resp, open(tmp, "wb") as out:
            shutil.copyfileobj(resp, out)
        tmp.replace(path)
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(
            f"Could not download the {kind} model: {exc}\n"
            f"Download it manually from\n  {url}\nand save it as\n  {path}"
        ) from exc
    return path
