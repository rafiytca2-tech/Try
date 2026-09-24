"""Import PyKinect2 on modern Python / numpy / comtypes.

PyKinect2 (Microsoft's Python wrapper for the Kinect for Windows SDK 2.0) has
not been updated since 2016-2018 and breaks on current software:

* ``numpy.object`` was removed in numpy 1.24,
* ``time.clock`` was removed in Python 3.8,
* ``ctypes.pythonapi.PyObject_AsWriteBuffer`` was removed in Python 3.10,
* ``numpy.distutils`` is gone in numpy 2 / Python 3.12 (GitHub version),
* ``comtypes._check_version('')`` raises on comtypes >= 1.1.8.

``import_pykinect2`` papers over all of these at runtime so an unmodified
install works.  The one thing that cannot be shimmed is the PyPI release's
``assert sizeof(tagSTATSTG) == 72`` (fails on 64-bit Python); for that, run
``python tools/patch_pykinect2.py`` or install PyKinect2 from GitHub.
"""

from __future__ import annotations

import ctypes
import struct
import sys
import time
import types


def _install_shims() -> None:
    import numpy

    if not hasattr(time, "clock"):
        time.clock = time.perf_counter  # type: ignore[attr-defined]

    try:
        numpy.object  # noqa: B018
    except AttributeError:
        numpy.object = object  # type: ignore[attr-defined]

    try:
        import numpy.distutils.system_info  # noqa: F401
    except Exception:
        fake = types.ModuleType("numpy.distutils.system_info")
        fake.platform_bits = struct.calcsize("P") * 8
        pkg = sys.modules.get("numpy.distutils") or types.ModuleType("numpy.distutils")
        pkg.system_info = fake
        sys.modules["numpy.distutils"] = pkg
        sys.modules["numpy.distutils.system_info"] = fake
        numpy.distutils = pkg  # type: ignore[attr-defined]

    if sys.platform == "win32" and not hasattr(ctypes.pythonapi, "PyObject_AsWriteBuffer"):
        # Only used by PyKinect2's pygame helper; any function pointer will do.
        ctypes.pythonapi.PyObject_AsWriteBuffer = ctypes.pythonapi._FuncPtr(  # type: ignore[attr-defined]
            ("PyObject_GetBuffer", ctypes.pythonapi)
        )


def import_pykinect2():
    """Return ``(PyKinectV2, PyKinectRuntime)`` or raise ImportError with a fix."""
    if sys.platform != "win32":
        raise ImportError("PyKinect2 needs Windows and the Kinect for Windows SDK 2.0")
    _install_shims()
    import comtypes

    original = getattr(comtypes, "_check_version", None)
    comtypes._check_version = lambda *args, **kwargs: None
    try:
        from pykinect2 import PyKinectRuntime, PyKinectV2
    except AssertionError as exc:
        raise ImportError(
            "PyKinect2 failed its 32-bit struct size check on 64-bit Python. "
            "Run `python tools/patch_pykinect2.py` once to fix the installed copy."
        ) from exc
    finally:
        if original is not None:
            comtypes._check_version = original
    return PyKinectV2, PyKinectRuntime
