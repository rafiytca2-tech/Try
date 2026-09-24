"""Keyboard / mouse output backends."""

from __future__ import annotations

import logging
import sys
from typing import List, Optional, Tuple

from .keys import Combo

log = logging.getLogger(__name__)


class InputBackend:
    """Interface for sending synthetic input."""

    name = "none"

    def press(self, combo: Combo) -> None: ...
    def release(self, combo: Combo) -> None: ...

    def tap(self, combo: Combo) -> None:
        self.press(combo)
        self.release(combo)

    def type_text(self, text: str) -> None: ...
    def mouse_down(self, button: str) -> None: ...
    def mouse_up(self, button: str) -> None: ...
    def click(self, button: str, count: int = 1) -> None: ...
    def scroll(self, dx: int, dy: int) -> None: ...
    def move_to(self, x: float, y: float) -> None: ...
    def move_by(self, dx: float, dy: float) -> None: ...

    def position(self) -> Optional[Tuple[float, float]]:
        return None


class DryRunBackend(InputBackend):
    """Records what would have been sent. Used for --dry-run and tests."""

    name = "dry-run"

    def __init__(self, verbose: bool = True):
        self.calls: List[tuple] = []
        self.verbose = verbose
        self._pos = (0.0, 0.0)

    def _record(self, *call) -> None:
        self.calls.append(call)
        if self.verbose and call[0] not in ("move_to", "move_by"):
            log.info("[dry-run] %s", " ".join(str(c) for c in call))

    def press(self, combo): self._record("press", "+".join(combo))
    def release(self, combo): self._record("release", "+".join(combo))
    def tap(self, combo): self._record("tap", "+".join(combo))
    def type_text(self, text): self._record("type", text)
    def mouse_down(self, button): self._record("mouse_down", button)
    def mouse_up(self, button): self._record("mouse_up", button)
    def click(self, button, count=1): self._record("click", button, count)
    def scroll(self, dx, dy): self._record("scroll", dx, dy)

    def move_to(self, x, y):
        self._pos = (x, y)
        self._record("move_to", round(x), round(y))

    def move_by(self, dx, dy):
        self._pos = (self._pos[0] + dx, self._pos[1] + dy)
        self._record("move_by", round(dx), round(dy))

    def position(self):
        return self._pos


class PynputBackend(InputBackend):
    """Real keyboard/mouse via pynput (Windows, macOS, Linux/X11)."""

    name = "pynput"

    def __init__(self):
        from pynput import keyboard, mouse  # raises on headless Linux

        self._kb_mod = keyboard
        self._mouse_mod = mouse
        self.kb = keyboard.Controller()
        self.mouse = mouse.Controller()
        self._buttons = {
            "left": mouse.Button.left,
            "right": mouse.Button.right,
            "middle": mouse.Button.middle,
        }

    def _key(self, name: str):
        if len(name) == 1:
            return self._kb_mod.KeyCode.from_char(name)
        key = getattr(self._kb_mod.Key, name, None)
        if key is None:
            raise ValueError(f"key {name!r} is not available on this platform")
        return key

    def press(self, combo):
        for name in combo:
            self.kb.press(self._key(name))

    def release(self, combo):
        for name in reversed(combo):
            self.kb.release(self._key(name))

    def type_text(self, text):
        self.kb.type(text)

    def mouse_down(self, button):
        self.mouse.press(self._buttons[button])

    def mouse_up(self, button):
        self.mouse.release(self._buttons[button])

    def click(self, button, count=1):
        self.mouse.click(self._buttons[button], count)

    def scroll(self, dx, dy):
        self.mouse.scroll(dx, dy)

    def move_to(self, x, y):
        self.mouse.position = (int(x), int(y))

    def move_by(self, dx, dy):
        self.mouse.move(int(round(dx)), int(round(dy)))

    def position(self):
        return self.mouse.position


def create_backend(dry_run: bool) -> InputBackend:
    if dry_run:
        return DryRunBackend()
    try:
        return PynputBackend()
    except Exception as exc:  # pynput missing, or no display on Linux
        log.warning("Keyboard/mouse output unavailable (%s); falling back to dry-run.", exc)
        return DryRunBackend()


def enable_dpi_awareness() -> None:
    """On Windows, stop display scaling from skewing cursor coordinates."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def screen_size(override=None) -> Tuple[int, int]:
    if override:
        return int(override[0]), int(override[1])
    if sys.platform == "win32":
        try:
            import ctypes

            user32 = ctypes.windll.user32
            return int(user32.GetSystemMetrics(0)), int(user32.GetSystemMetrics(1))
        except Exception:
            pass
    try:
        import tkinter

        root = tkinter.Tk()
        root.withdraw()
        size = (root.winfo_screenwidth(), root.winfo_screenheight())
        root.destroy()
        return size
    except Exception:
        log.warning("Could not detect the screen size; assuming 1920x1080 (set cursor.screen).")
        return 1920, 1080
