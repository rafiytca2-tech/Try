"""Turns gesture events into keyboard / mouse / shell actions according to bindings."""

from __future__ import annotations

import logging
import shlex
import subprocess
import sys
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..types import END, START, TRIGGER, GestureEvent
from .backends import InputBackend
from .keys import parse_keys

log = logging.getLogger(__name__)

HOLD_ACTIONS = {"key_hold", "mouse_hold"}
CONTROL_ACTIONS = {"toggle_actions", "toggle_cursor", "calibrate_head", "log"}


class Binding:
    def __init__(self, spec: Dict[str, Any]):
        self.spec = spec
        self.gesture = str(spec["gesture"]).upper()
        self.action = spec["action"]
        self.hand = spec.get("hand", "any")
        self.source = spec.get("source", "any")
        self.on = spec.get("on", "start")
        self.cooldown = float(spec.get("cooldown", 0.0))
        self.requires_cursor = bool(spec.get("requires_cursor", False))
        self.keys = parse_keys(spec.get("keys")) if self.action in ("key", "key_hold") else []
        self.last_fired = float("-inf")

    def matches(self, event: GestureEvent) -> bool:
        if event.name != self.gesture:
            return False
        if self.hand != "any" and event.side != self.hand:
            return False
        if self.source != "any" and event.source != self.source:
            return False
        return True

    def describe(self) -> str:
        detail = {
            "key": lambda: self.spec.get("keys"),
            "key_hold": lambda: self.spec.get("keys"),
            "type": lambda: repr(self.spec.get("text", "")),
            "click": lambda: self.spec.get("button", "left"),
            "mouse_hold": lambda: self.spec.get("button", "left"),
            "scroll": lambda: f"{self.spec.get('dx', 0)},{self.spec.get('dy', 0)}",
            "command": lambda: self.spec.get("cmd"),
            "log": lambda: repr(self.spec.get("message", self.gesture)),
        }.get(self.action, lambda: "")()
        return f"{self.action} {detail}".strip()


class ActionExecutor:
    """Matches events against bindings and performs the actions.

    Hold actions (``key_hold``, ``mouse_hold``) press on START and release on END
    of the same gesture; on a momentary gesture they tap.  Other actions fire on
    the binding's ``on`` phase (``start`` also accepts momentary gestures).
    """

    def __init__(
        self,
        bindings: List[Dict[str, Any]],
        backend: InputBackend,
        enabled: bool = True,
        cursor_active: Callable[[], bool] = lambda: False,
        on_toggle_cursor: Callable[[], None] = lambda: None,
        on_calibrate_head: Callable[[], None] = lambda: None,
    ):
        self.bindings = [Binding(b) for b in bindings]
        self.backend = backend
        self.enabled = enabled
        self.cursor_active = cursor_active
        self.on_toggle_cursor = on_toggle_cursor
        self.on_calibrate_head = on_calibrate_head
        # (binding index, side) -> what is being held
        self._holds: Dict[Tuple[int, Optional[str]], Binding] = {}

    # ------------------------------------------------------------------ public
    def handle(self, event: GestureEvent) -> List[str]:
        done: List[str] = []
        for idx, binding in enumerate(self.bindings):
            if not binding.matches(event):
                continue
            if binding.action in HOLD_ACTIONS:
                msg = self._handle_hold(idx, binding, event)
            else:
                msg = self._handle_simple(binding, event)
            if msg:
                done.append(msg)
        return done

    def set_enabled(self, enabled: bool) -> None:
        self.enabled = enabled
        if not enabled:
            self.release_all()
        log.info("Actions %s", "ARMED" if enabled else "PAUSED")

    def release_all(self) -> None:
        for (idx, _side), binding in list(self._holds.items()):
            self._release(binding)
        self._holds.clear()

    # ----------------------------------------------------------------- helpers
    def _allowed(self, binding: Binding, now: float) -> bool:
        if binding.action not in CONTROL_ACTIONS and not self.enabled:
            return False
        if binding.requires_cursor and not self.cursor_active():
            return False
        return now - binding.last_fired >= binding.cooldown

    def _handle_simple(self, binding: Binding, event: GestureEvent) -> Optional[str]:
        wanted = binding.on
        if not (event.phase == wanted or (wanted == START and event.phase == TRIGGER)):
            return None
        if not self._allowed(binding, event.timestamp):
            return None
        binding.last_fired = event.timestamp
        self._run(binding, event)
        return f"{event.name} -> {binding.describe()}"

    def _handle_hold(self, idx: int, binding: Binding, event: GestureEvent) -> Optional[str]:
        key = (idx, event.side)
        if event.phase == END:
            held = self._holds.pop(key, None)
            if held is None:
                return None
            self._release(held)
            return f"{event.name} end -> release {binding.describe()}"
        if not self._allowed(binding, event.timestamp):
            return None
        binding.last_fired = event.timestamp
        if event.phase == TRIGGER:
            self._press(binding)
            self._release(binding)
            return f"{event.name} -> tap {binding.describe()}"
        if key in self._holds:
            return None
        self._press(binding)
        self._holds[key] = binding
        return f"{event.name} -> hold {binding.describe()}"

    def _press(self, binding: Binding) -> None:
        try:
            if binding.action == "key_hold":
                for combo in binding.keys:
                    self.backend.press(combo)
            else:
                self.backend.mouse_down(binding.spec.get("button", "left"))
        except Exception as exc:
            log.error("Action %s failed: %s", binding.describe(), exc)

    def _release(self, binding: Binding) -> None:
        try:
            if binding.action == "key_hold":
                for combo in reversed(binding.keys):
                    self.backend.release(combo)
            else:
                self.backend.mouse_up(binding.spec.get("button", "left"))
        except Exception as exc:
            log.error("Releasing %s failed: %s", binding.describe(), exc)

    def _run(self, binding: Binding, event: GestureEvent) -> None:
        spec, action = binding.spec, binding.action
        try:
            if action == "key":
                for combo in binding.keys:
                    self.backend.tap(combo)
            elif action == "type":
                self.backend.type_text(str(spec.get("text", "")))
            elif action == "click":
                self.backend.click(spec.get("button", "left"), int(spec.get("count", 1)))
            elif action == "scroll":
                self.backend.scroll(int(spec.get("dx", 0)), int(spec.get("dy", 0)))
            elif action == "command":
                run_command(spec["cmd"])
            elif action == "log":
                log.info("%s: %s", event.label(), spec.get("message", event.name))
            elif action == "toggle_actions":
                self.set_enabled(not self.enabled)
            elif action == "toggle_cursor":
                self.on_toggle_cursor()
            elif action == "calibrate_head":
                self.on_calibrate_head()
        except Exception as exc:
            log.error("Action %s failed: %s", binding.describe(), exc)


def run_command(cmd) -> None:
    """Start a command without waiting for it. Strings go through the shell."""
    if isinstance(cmd, (list, tuple)):
        subprocess.Popen(list(cmd))
    elif sys.platform == "win32":
        subprocess.Popen(cmd, shell=True)
    else:
        subprocess.Popen(cmd, shell=True, start_new_session=True)
    log.info("Started command: %s", cmd if isinstance(cmd, str) else shlex.join(cmd))
