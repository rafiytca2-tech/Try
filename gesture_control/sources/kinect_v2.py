"""Xbox One Kinect / Kinect for Windows v2.

Backends
--------
``pykinect2``    Windows + Kinect for Windows SDK 2.0.  Colour 1920x1080, depth
                 mapped onto colour, the SDK's 25-joint skeletons for up to six
                 people and native open/closed/lasso hand states.
``libfreenect2`` Linux / macOS / Windows via the open-source driver and
                 ``pylibfreenect2``.  Colour + registered depth (no skeleton).
``uvc``          With the SDK installed, Windows also exposes the Kinect colour
                 camera as a normal webcam; colour only, opened through OpenCV.
"""

from __future__ import annotations

import ctypes
import logging
import sys
import time
from typing import Dict, List, Optional

import cv2
import numpy as np

from ..types import Body, Joint
from .base import FrameSource, Grabbed, SourceError
from .webcam import open_capture

log = logging.getLogger(__name__)

# Kinect SDK JointType order
JOINT_NAMES = [
    "SpineBase", "SpineMid", "Neck", "Head", "ShoulderLeft", "ElbowLeft", "WristLeft",
    "HandLeft", "ShoulderRight", "ElbowRight", "WristRight", "HandRight", "HipLeft",
    "KneeLeft", "AnkleLeft", "FootLeft", "HipRight", "KneeRight", "AnkleRight", "FootRight",
    "SpineShoulder", "HandTipLeft", "ThumbLeft", "HandTipRight", "ThumbRight",
]
BONES = [
    ("Head", "Neck"), ("Neck", "SpineShoulder"), ("SpineShoulder", "SpineMid"),
    ("SpineMid", "SpineBase"), ("SpineShoulder", "ShoulderRight"), ("SpineShoulder", "ShoulderLeft"),
    ("SpineBase", "HipRight"), ("SpineBase", "HipLeft"), ("ShoulderRight", "ElbowRight"),
    ("ElbowRight", "WristRight"), ("WristRight", "HandRight"), ("HandRight", "HandTipRight"),
    ("WristRight", "ThumbRight"), ("ShoulderLeft", "ElbowLeft"), ("ElbowLeft", "WristLeft"),
    ("WristLeft", "HandLeft"), ("HandLeft", "HandTipLeft"), ("WristLeft", "ThumbLeft"),
    ("HipRight", "KneeRight"), ("KneeRight", "AnkleRight"), ("AnkleRight", "FootRight"),
    ("HipLeft", "KneeLeft"), ("KneeLeft", "AnkleLeft"), ("AnkleLeft", "FootLeft"),
]
HAND_STATES = {0: "unknown", 1: "unknown", 2: "open", 3: "closed", 4: "lasso"}
DEPTH_CELL = 4  # colour pixels per aligned-depth cell (1920x1080 -> 480x270)


def depth_to_color_grid(color_xy: np.ndarray, depth: np.ndarray, color_w: int, color_h: int,
                        cell: int = DEPTH_CELL) -> np.ndarray:
    """Scatter depth pixels, already mapped to colour coordinates, into a coarse
    colour-aligned depth image of shape ``(color_h // cell, color_w // cell)``.

    ``color_xy`` is ``(N, 2)`` colour-space x/y for each of the ``N`` depth pixels
    (``-inf``/NaN where unmapped); ``depth`` holds the N values in millimetres.
    Where several depth pixels land in one cell the nearest one wins.
    """
    d = depth.astype(np.float32).ravel()
    u = color_xy[:, 0]
    v = color_xy[:, 1]
    ok = np.isfinite(u) & np.isfinite(v) & (d > 0) & (u >= 0) & (v >= 0) & (u < color_w) & (v < color_h)
    gw, gh = color_w // cell, color_h // cell
    cols = np.minimum((u[ok] / cell).astype(np.int32), gw - 1)
    rows = np.minimum((v[ok] / cell).astype(np.int32), gh - 1)
    vals = d[ok]
    order = np.argsort(-vals, kind="stable")  # far first, so near values are written last
    grid = np.zeros((gh, gw), np.float32)
    grid[rows[order], cols[order]] = vals[order]
    # close the one-cell gaps left by the sparser depth sampling
    filled = cv2.dilate(grid, np.ones((3, 3), np.uint8))
    return np.where(grid > 0, grid, filled)


class _PyKinect2Backend:
    name = "pykinect2"

    def __init__(self, cfg: dict):
        from .pykinect2_compat import import_pykinect2

        self.V2, runtime = import_pykinect2()
        self.want_depth = bool(cfg.get("depth", True))
        self.want_body = bool(cfg.get("body", True))
        flags = self.V2.FrameSourceTypes_Color
        if self.want_depth:
            flags |= self.V2.FrameSourceTypes_Depth
        if self.want_body:
            flags |= self.V2.FrameSourceTypes_Body
        self.kinect = runtime.PyKinectRuntime(flags)
        self.cw = int(self.kinect.color_frame_desc.Width)
        self.ch = int(self.kinect.color_frame_desc.Height)
        self._depth: Optional[np.ndarray] = None
        self._bodies: List[Body] = []
        self._mapping_ok = True
        n_depth = 512 * 424
        self._csp = (self.V2._ColorSpacePoint * n_depth)()

    def grab(self) -> Optional[Grabbed]:
        k = self.kinect
        deadline = time.monotonic() + 1.0
        while not k.has_new_color_frame():
            if time.monotonic() > deadline:
                return None
            time.sleep(0.002)
        color = k.get_last_color_frame()
        if color is None:
            return None
        image = cv2.cvtColor(color.reshape((self.ch, self.cw, 4)), cv2.COLOR_BGRA2BGR)
        if self.want_depth and k.has_new_depth_frame():
            depth = k.get_last_depth_frame()
            if depth is not None:
                self._depth = self._align_depth(depth)
        if self.want_body and k.has_new_body_frame():
            frame = k.get_last_body_frame()
            if frame is not None and frame.bodies is not None:
                self._bodies = self._convert_bodies(frame)
        return image, self._depth, list(self._bodies)

    def _align_depth(self, depth: np.ndarray) -> Optional[np.ndarray]:
        if not self._mapping_ok:
            return None
        depth = np.ascontiguousarray(depth, dtype=np.uint16)
        n = depth.size
        try:
            self.kinect._mapper.MapDepthFrameToColorSpace(
                ctypes.c_uint(n),
                depth.ctypes.data_as(ctypes.POINTER(ctypes.c_ushort)),
                ctypes.c_uint(n),
                ctypes.cast(self._csp, ctypes.POINTER(self.V2._ColorSpacePoint)),
            )
        except Exception as exc:
            log.warning("Kinect depth->colour mapping failed (%s); depth disabled.", exc)
            self._mapping_ok = False
            return None
        xy = np.ctypeslib.as_array(ctypes.cast(self._csp, ctypes.POINTER(ctypes.c_float)), shape=(n * 2,))
        return depth_to_color_grid(xy.reshape(-1, 2).copy(), depth, self.cw, self.ch)

    def _convert_bodies(self, frame) -> List[Body]:
        mapper = self.kinect._mapper
        out = []
        for body in frame.bodies:
            if body is None or not body.is_tracked:
                continue
            joints: Dict[str, Joint] = {}
            for j, name in enumerate(JOINT_NAMES):
                jt = body.joints[j]
                if jt.TrackingState == 0:  # NotTracked
                    continue
                p = mapper.MapCameraPointToColorSpace(jt.Position)
                pixel = (float(p.x), float(p.y)) if np.isfinite(p.x) and np.isfinite(p.y) else None
                joints[name] = Joint(
                    name, (float(jt.Position.x), float(jt.Position.y), float(jt.Position.z)),
                    pixel, jt.TrackingState == 2,
                )
            states = {
                "left": HAND_STATES.get(int(body.hand_left_state), "unknown"),
                "right": HAND_STATES.get(int(body.hand_right_state), "unknown"),
            }
            out.append(Body(int(body.tracking_id), joints, states))
        return out

    def close(self) -> None:
        self.kinect.close()


class _Freenect2Backend:
    name = "libfreenect2"
    PIPELINES = {
        "cuda": "CudaPacketPipeline",
        "opencl": "OpenCLPacketPipeline",
        "opengl": "OpenGLPacketPipeline",
        "cpu": "CpuPacketPipeline",
    }

    def __init__(self, cfg: dict):
        import pylibfreenect2 as fn2

        self.fn2 = fn2
        self.want_depth = bool(cfg.get("depth", True))
        try:
            fn2.setGlobalLogger(fn2.createConsoleLogger(fn2.LoggerLevel.Warning))
        except Exception:
            pass
        self.fn = fn2.Freenect2()
        count = self.fn.enumerateDevices()
        if count == 0:
            raise SourceError("libfreenect2 found no Kinect v2 (check USB 3.0 port, power supply, udev rules)")
        device = cfg.get("device", 0)
        if isinstance(device, str) and not device.isdigit():
            serial = device
        else:
            serial = self.fn.getDeviceSerialNumber(int(device))
        pipeline = self._pipeline(str(cfg.get("pipeline", "auto")))
        self.device = self.fn.openDevice(serial, pipeline=pipeline)
        types = fn2.FrameType.Color
        if self.want_depth:
            types |= fn2.FrameType.Ir | fn2.FrameType.Depth
        self.listener = fn2.SyncMultiFrameListener(types)
        self.device.setColorFrameListener(self.listener)
        if self.want_depth:
            self.device.setIrAndDepthFrameListener(self.listener)
        self.device.start()
        if self.want_depth:
            self.registration = fn2.Registration(
                self.device.getIrCameraParams(), self.device.getColorCameraParams()
            )
            self.undistorted = fn2.Frame(512, 424, 4)
            self.registered = fn2.Frame(512, 424, 4)
            self.bigdepth = fn2.Frame(1920, 1082, 4)

    def _pipeline(self, name: str):
        order = ["cuda", "opencl", "opengl", "cpu"] if name == "auto" else [name]
        for key in order:
            cls = getattr(self.fn2, self.PIPELINES.get(key, ""), None)
            if cls is None:
                continue
            try:
                pipeline = cls()
                log.info("libfreenect2 using %s pipeline", key)
                return pipeline
            except Exception as exc:
                log.debug("libfreenect2 %s pipeline unavailable: %s", key, exc)
        raise SourceError(f"no usable libfreenect2 pipeline for {name!r}")

    def grab(self) -> Optional[Grabbed]:
        frames = self.listener.waitForNewFrame()
        try:
            color = frames["color"]
            image = cv2.cvtColor(color.asarray(), cv2.COLOR_BGRA2BGR)
            depth = None
            if self.want_depth:
                self.registration.apply(
                    color, frames["depth"], self.undistorted, self.registered, bigdepth=self.bigdepth
                )
                big = self.bigdepth.asarray(np.float32)[1:-1]  # 1082 -> 1080 rows
                h, w = big.shape
                depth = cv2.resize(big, (w // DEPTH_CELL, h // DEPTH_CELL), interpolation=cv2.INTER_NEAREST)
                depth[~np.isfinite(depth)] = 0
        finally:
            self.listener.release(frames)
        return image, depth, []

    def close(self) -> None:
        self.device.stop()
        self.device.close()


class _UvcBackend:
    """The Kinect colour camera as exposed to Windows as a regular webcam."""

    name = "uvc"

    def __init__(self, cfg: dict):
        self.cap = open_capture(cfg.get("device", 0), cfg.get("api", "auto"), 1920, 1080, 30)

    def grab(self) -> Optional[Grabbed]:
        ok, image = self.cap.read()
        return (image, None, []) if ok else None

    def close(self) -> None:
        self.cap.release()


BACKENDS = {"pykinect2": _PyKinect2Backend, "libfreenect2": _Freenect2Backend, "uvc": _UvcBackend}

INSTALL_HELP = (
    "No Kinect v2 driver found. Install one of:\n"
    "  Windows : Kinect for Windows SDK 2.0, then `pip install comtypes "
    "git+https://github.com/Kinect/PyKinect2.git`\n"
    "  Linux/macOS : libfreenect2 (github.com/OpenKinect/libfreenect2), then `pip install pylibfreenect2`\n"
    "  Colour only on Windows: set `backend: uvc` and the Kinect's camera index as `device`.\n"
    "Or run without the Kinect: --no-kinect"
)


class KinectV2Source(FrameSource):
    def __init__(self, name: str, cfg: dict):
        super().__init__(name, cfg)
        self.backend = None

    def describe(self) -> str:
        kind = self.backend.name if self.backend else "not opened"
        return f"{self.name}: Kinect v2 via {kind}"

    def _open(self) -> None:
        wanted = str(self.cfg.get("backend", "auto")).lower()
        if wanted == "auto":
            order = ["pykinect2", "libfreenect2"] if sys.platform == "win32" else ["libfreenect2"]
        elif wanted in BACKENDS:
            order = [wanted]
        else:
            raise SourceError(f"unknown Kinect backend {wanted!r} (use auto, {', '.join(BACKENDS)})")
        problems = []
        for key in order:
            try:
                self.backend = BACKENDS[key](self.cfg)
                log.info("Opened %s", self.describe())
                return
            except ImportError as exc:
                problems.append(f"{key}: {exc}")
            except SourceError as exc:
                problems.append(f"{key}: {exc}")
            except Exception as exc:  # driver errors (COM, USB ...)
                problems.append(f"{key}: {type(exc).__name__}: {exc}")
        detail = "\n  ".join(problems)
        raise SourceError(f"could not open the Kinect v2.\n  {detail}\n{INSTALL_HELP}")

    def _grab(self) -> Optional[Grabbed]:
        return self.backend.grab()

    def _close(self) -> None:
        if self.backend is not None:
            self.backend.close()
            self.backend = None
