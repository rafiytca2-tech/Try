"""`--check` and `--list-cameras`: what hardware and software is available."""

from __future__ import annotations

import platform
import struct
import sys
from typing import Dict, List, Tuple


def list_cameras(max_index: int = 8) -> List[Tuple[int, int, int]]:
    """Indices of cameras that open and deliver a frame, with their resolution."""
    import cv2

    from .sources.webcam import open_capture

    logging_api = getattr(getattr(cv2, "utils", None), "logging", None)
    previous = None
    if logging_api is not None:  # probing missing indices makes OpenCV print errors
        previous = logging_api.getLogLevel()
        logging_api.setLogLevel(logging_api.LOG_LEVEL_SILENT)
    found = []
    try:
        for index in range(max_index):
            try:
                cap = open_capture(index)
            except Exception:
                continue
            ok, frame = cap.read()
            cap.release()
            if ok and frame is not None:
                found.append((index, frame.shape[1], frame.shape[0]))
    finally:
        if previous is not None:
            logging_api.setLogLevel(previous)
    return found


def _line(ok, label: str, detail: str = "") -> str:
    mark = {True: "ok ", False: "-- ", None: " ? "}[ok]
    return f"  [{mark}] {label}" + (f": {detail}" if detail else "")


def run_checks(cfg: Dict) -> int:
    from .models import MODELS, models_dir

    out = [f"Python {platform.python_version()} ({struct.calcsize('P') * 8}-bit) on {platform.platform()}"]
    out.append("Libraries")
    for module in ("numpy", "cv2", "mediapipe", "yaml"):
        try:
            mod = __import__(module)
            out.append(_line(True, module, getattr(mod, "__version__", "")))
        except Exception as exc:
            out.append(_line(False, module, str(exc)))

    try:
        from .actions.backends import PynputBackend

        PynputBackend()
        out.append(_line(True, "keyboard/mouse output (pynput)"))
    except Exception as exc:
        reason = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
        out.append(_line(False, "keyboard/mouse output (pynput)", f"{reason} -> actions will be dry-run only"))

    out.append("Models")
    directory = models_dir(cfg.get("models_dir"))
    for kind, (filename, _url) in MODELS.items():
        path = directory / filename
        out.append(_line(path.is_file() or None, f"{kind} model", str(path) if path.is_file()
                         else f"not downloaded yet (fetched automatically, or run --download-models) -> {path}"))

    out.append("Webcams")
    cams = list_cameras()
    if cams:
        for index, w, h in cams:
            out.append(_line(True, f"camera {index}", f"{w}x{h}"))
    else:
        out.append(_line(False, "no cameras found"))

    out.append("Kinect v2")
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.WinDLL("Kinect20")
            out.append(_line(True, "Kinect for Windows SDK 2.0 runtime (Kinect20.dll)"))
        except Exception:
            out.append(_line(False, "Kinect for Windows SDK 2.0 runtime", "not installed (needed for pykinect2)"))
        try:
            from .sources.pykinect2_compat import import_pykinect2

            import_pykinect2()
            out.append(_line(True, "pykinect2"))
        except Exception as exc:
            out.append(_line(False, "pykinect2", str(exc)))
    else:
        out.append(_line(None, "pykinect2", "Windows only"))
    try:
        import pylibfreenect2 as fn2

        count = fn2.Freenect2().enumerateDevices()
        out.append(_line(count > 0, "libfreenect2", f"{count} device(s)"))
    except Exception as exc:
        out.append(_line(False, "pylibfreenect2", str(exc)))

    print("\n".join(out))
    return 0
