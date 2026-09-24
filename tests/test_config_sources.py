import subprocess
import sys
import textwrap
from pathlib import Path

import cv2
import numpy as np
import pytest

from gesture_control.cli import apply_overrides, build_parser
from gesture_control.config import load_config, load_default_config, write_default_config
from gesture_control.perception.depth import depth_at
from gesture_control.sources import WebcamSource, create_source, mirror_frame
from gesture_control.sources.kinect_v2 import depth_to_color_grid
from gesture_control.types import Body, Joint

ROOT = Path(__file__).resolve().parents[1]


def test_default_config_is_valid():
    cfg = load_config()
    assert set(cfg["sources"]) == {"webcam", "kinect"}
    assert cfg["bindings"]


def test_user_config_merges(tmp_path):
    path = tmp_path / "c.yaml"
    path.write_text("hands: {swipe: {min_distance: 0.3}}\nbindings: []\n")
    cfg = load_config(str(path))
    assert cfg["hands"]["swipe"]["min_distance"] == 0.3
    assert cfg["hands"]["swipe"]["window"] == 0.45  # default kept
    assert cfg["bindings"] == []


def test_user_sources_replace_defaults(tmp_path):
    path = tmp_path / "c.yaml"
    path.write_text("sources:\n  side_cam: {type: webcam, device: 1}\n")
    cfg = load_config(str(path))
    assert list(cfg["sources"]) == ["side_cam"]
    assert cfg["sources"]["side_cam"]["trackers"] == ["hands", "face"]  # webcam defaults filled in


@pytest.mark.parametrize("text, message", [
    ("bindings: [{gesture: NOPE, action: key, keys: a}]", "unknown gesture"),
    ("bindings: [{gesture: FIST, action: explode}]", "unknown action"),
    ("bindings: [{gesture: FIST, action: key, keys: 'ctrl+wat'}]", "unknown key"),
    ("sources: {cam: {type: webcam, trackers: [feet]}}", "unknown tracker"),
])
def test_invalid_configs(tmp_path, text, message):
    path = tmp_path / "c.yaml"
    path.write_text(text)
    with pytest.raises(ValueError, match=message):
        load_config(str(path))


def test_write_default_config_roundtrip(tmp_path):
    path = tmp_path / "copy.yaml"
    write_default_config(str(path))
    assert load_config(str(path)) == load_default_config()


def test_cli_overrides():
    cfg = load_config()
    args = build_parser().parse_args(["--no-kinect", "--webcam", "clip.mp4", "--cursor", "head",
                                      "--dry-run", "--udp", "10.0.0.2:6000", "--paused"])
    cfg = apply_overrides(cfg, args)
    assert cfg["sources"]["kinect"]["enabled"] is False
    assert cfg["sources"]["webcam"]["device"] == "clip.mp4"
    assert cfg["cursor"] == {**cfg["cursor"], "enabled": True, "mode": "head"}
    assert cfg["actions"]["dry_run"] and not cfg["actions"]["enabled"]
    assert cfg["output"]["udp"]["host"] == "10.0.0.2" and cfg["output"]["udp"]["port"] == 6000


def test_mirror_frame_flips_image_depth_and_joints():
    img = np.zeros((4, 10, 3), np.uint8)
    img[:, 0] = 255
    depth = np.zeros((2, 5), np.float32)
    depth[:, 0] = 1000
    b = Body(1, {"Head": Joint("Head", (0.1, 0.5, 2.0), (2.0, 1.0), True)}, {"left": "open", "right": "closed"})
    img2, depth2, (b2,) = mirror_frame(img, depth, [b])
    assert img2[0, -1, 0] == 255 and depth2[0, -1] == 1000
    assert b2.joints["Head"].pixel == (7.0, 1.0)
    assert b2.joints["Head"].position == (0.1, 0.5, 2.0)


def test_depth_to_color_grid_nearest_wins_and_bounds():
    xy = np.array([[10.0, 10.0], [11.0, 11.0], [100.0, 50.0], [-5.0, 3.0], [np.nan, 1.0], [5000.0, 5.0]])
    depth = np.array([2000, 1500, 800, 700, 600, 500], np.uint16)
    grid = depth_to_color_grid(xy, depth, 1920, 1080)
    assert grid.shape == (270, 480)
    assert grid[2, 2] == 1500      # both of the first two land in cell (2, 2); nearer wins
    assert grid[12, 25] == 800
    assert (grid > 0).sum() <= 18  # only the two valid cells and their gap-filling neighbours


def test_depth_at():
    depth = np.zeros((270, 480), np.float32)
    depth[135, 240] = 1234
    assert depth_at(depth, 0.5, 0.5) == 1234
    assert depth_at(depth, 0.1, 0.1) is None
    assert depth_at(None, 0.5, 0.5) is None


def test_webcam_source_reads_video_file_losslessly(tmp_path):
    path = str(tmp_path / "clip.avi")
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"MJPG"), 30, (64, 48))
    for i in range(10):
        writer.write(np.full((48, 64, 3), i * 20, np.uint8))
    writer.release()
    src = create_source("clip", {"type": "webcam", "device": path, "mirror": True, "realtime": False})
    assert isinstance(src, WebcamSource) and src.lossless
    src.start()
    frames = []
    while True:
        f = src.read(timeout=2)
        if f is None:
            break
        frames.append(f)
    src.stop()
    assert [f.index for f in frames] == list(range(10))
    assert all(b.timestamp > a.timestamp for a, b in zip(frames, frames[1:]))
    assert src.finished


def test_missing_camera_raises():
    from gesture_control.sources import SourceError

    src = create_source("nope", {"type": "webcam", "device": str(ROOT / "does-not-exist.mp4")})
    with pytest.raises(SourceError):
        src.start()


def test_kinect_without_driver_gives_install_help():
    from gesture_control.sources import SourceError

    import importlib.util

    if importlib.util.find_spec("pylibfreenect2"):
        pytest.skip("libfreenect2 installed")
    src = create_source("k", {"type": "kinect_v2", "backend": "libfreenect2"})
    with pytest.raises(SourceError, match="Kinect"):
        src.start()


def test_pykinect2_shims_in_subprocess():
    code = textwrap.dedent("""
        import time, numpy
        from gesture_control.sources.pykinect2_compat import _install_shims
        _install_shims()
        import numpy.distutils.system_info as sysinfo
        assert sysinfo.platform_bits in (32, 64)
        assert numpy.object is object
        assert time.clock() >= 0
        print("ok")
    """)
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True)
    assert out.stdout.strip() == "ok", out.stderr


def test_patch_script_is_idempotent(tmp_path):
    pkg = tmp_path / "pykinect2"
    pkg.mkdir()
    (pkg / "PyKinectV2.py").write_bytes(
        b"import numpy.distutils.system_info as sysinfo\r\n"
        b"assert sizeof(tagSTATSTG) == 72, sizeof(tagSTATSTG)\r\n"
        b"from comtypes import _check_version; _check_version('')\r\n")
    (pkg / "PyKinectRuntime.py").write_text(
        "import ctypes, time, numpy\n"
        "f = ctypes.pythonapi.PyObject_AsWriteBuffer\n"
        "t = time.clock()\n"
        "a = numpy.ndarray((3), dtype=numpy.object)\n"
        "b = numpy.object_\n")
    script = ROOT / "tools" / "patch_pykinect2.py"
    first = subprocess.run([sys.executable, str(script), str(pkg)], capture_output=True, text=True)
    assert "PyKinect2 patched." in first.stdout, first.stderr
    second = subprocess.run([sys.executable, str(script), str(pkg)], capture_output=True, text=True)
    assert "Nothing to do." in second.stdout
    v2 = (pkg / "PyKinectV2.py").read_bytes()
    assert b"\r\n" in v2 and b"in (72, 80)" in v2 and b"numpy.distutils.system_info" not in v2
    runtime = (pkg / "PyKinectRuntime.py").read_text()
    assert "time.perf_counter()" in runtime and "dtype=object" in runtime and "numpy.object_" in runtime
    assert (pkg / "PyKinectV2.py.orig").exists()
    compile(v2.decode().replace("\r\n", "\n"), "PyKinectV2.py", "exec")
    compile(runtime, "PyKinectRuntime.py", "exec")


@pytest.mark.parametrize("path", sorted((ROOT / "config").glob("*.yaml")), ids=lambda p: p.name)
def test_example_configs_are_valid(path):
    load_config(str(path))
