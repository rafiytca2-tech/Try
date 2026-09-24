"""Patch an installed PyKinect2 so it works on modern Python / numpy / comtypes.

gesture_control already works around most PyKinect2 problems at import time,
but the PyPI release (0.1.0) also contains ``assert sizeof(tagSTATSTG) == 72``,
which always fails on 64-bit Python and can only be fixed in the file itself.
This script fixes that and the other known issues permanently:

  * 64-bit struct size assertion            (PyKinectV2.py, PyPI release)
  * numpy.distutils import                  (PyKinectV2.py, GitHub version)
  * comtypes _check_version('') call        (PyKinectV2.py)
  * time.clock() -> time.perf_counter()     (PyKinectRuntime.py)
  * numpy.object -> object                  (PyKinectRuntime.py)
  * ctypes.pythonapi.PyObject_AsWriteBuffer (PyKinectRuntime.py, Python >= 3.10)

Usage:  python tools/patch_pykinect2.py [path/to/pykinect2]
A backup of each changed file is kept next to it as *.orig.  Safe to re-run.
"""

from __future__ import annotations

import importlib.util
import re
import shutil
import sys
from pathlib import Path
from typing import List, Tuple

Patch = Tuple[str, str, str]  # (description, regex, replacement)

V2_PATCHES: List[Patch] = [
    ("64-bit tagSTATSTG size check",
     r"^assert sizeof\(tagSTATSTG\) == 72, sizeof\(tagSTATSTG\)",
     "assert sizeof(tagSTATSTG) in (72, 80), sizeof(tagSTATSTG)"),
    ("numpy.distutils import",
     r"^import numpy\.distutils\.system_info as sysinfo[ \t]*$",
     "import struct as _struct  # patched: numpy.distutils is gone\n"
     "class sysinfo:  # noqa: N801\n"
     "    platform_bits = _struct.calcsize('P') * 8"),
    ("comtypes version check",
     r"^from comtypes import _check_version; _check_version\(''\)[ \t]*$",
     "# patched: comtypes version check removed"),
]

RUNTIME_PATCHES: List[Patch] = [
    ("time.clock()", r"\btime\.clock\(\)", "time.perf_counter()"),
    ("numpy.object", r"\bnumpy\.object\b(?!_)", "object"),
    ("PyObject_AsWriteBuffer",
     r"ctypes\.pythonapi\.PyObject_AsWriteBuffer\b",
     "ctypes.pythonapi._FuncPtr(('PyObject_AsWriteBuffer' if hasattr(ctypes.pythonapi, "
     "'PyObject_AsWriteBuffer') else 'PyObject_GetBuffer', ctypes.pythonapi))"),
]


def find_package(argv: List[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1])
    spec = importlib.util.find_spec("pykinect2")  # does not import the package's modules
    if spec is None or not spec.submodule_search_locations:
        raise SystemExit("pykinect2 is not installed in this Python environment.")
    return Path(list(spec.submodule_search_locations)[0])


def patch_file(path: Path, patches: List[Patch]) -> List[str]:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8").replace("\r\n", "\n")
    applied = []
    for description, pattern, replacement in patches:
        text, count = re.subn(pattern, replacement.replace("\\", "\\\\"), text, flags=re.MULTILINE)
        if count:
            applied.append(f"{description} ({count}x)")
    if applied:
        backup = path.with_suffix(path.suffix + ".orig")
        if not backup.exists():
            shutil.copy2(path, backup)
        path.write_bytes(text.replace("\n", newline).encode("utf-8"))
    return applied


def main(argv: List[str]) -> int:
    package = find_package(argv)
    targets = {"PyKinectV2.py": V2_PATCHES, "PyKinectRuntime.py": RUNTIME_PATCHES}
    changed = False
    for filename, patches in targets.items():
        path = package / filename
        if not path.is_file():
            print(f"missing: {path}")
            return 1
        applied = patch_file(path, patches)
        changed |= bool(applied)
        print(f"{path}: " + (", ".join(applied) if applied else "already OK"))
    print("PyKinect2 patched." if changed else "Nothing to do.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
