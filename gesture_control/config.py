"""Configuration loading: YAML defaults deep-merged with the user's file."""

from __future__ import annotations

import copy
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

log = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = Path(__file__).with_name("default_config.yaml")

HAND_POSES = (
    "FIST", "OPEN_PALM", "POINT", "VICTORY", "THREE", "FOUR", "THUMBS_UP",
    "THUMBS_DOWN", "ROCK", "CALL_ME", "OK", "PINCH",
)
HAND_MOTIONS = ("SWIPE_LEFT", "SWIPE_RIGHT", "SWIPE_UP", "SWIPE_DOWN", "PUSH", "PULL", "WAVE")
FACE_GESTURES = (
    "SMILE", "MOUTH_OPEN", "BROWS_RAISED", "EYES_CLOSED", "WINK_LEFT", "WINK_RIGHT",
    "BLINK", "DOUBLE_BLINK",
)
HEAD_GESTURES = (
    "TURN_LEFT", "TURN_RIGHT", "LOOK_UP", "LOOK_DOWN", "TILT_LEFT", "TILT_RIGHT", "NOD", "SHAKE",
)
BODY_GESTURES = ("HAND_OPEN", "HAND_CLOSED", "HAND_LASSO", "RAISE_HAND", "BOTH_HANDS_UP")
TRACKERS = ("hands", "face", "body")


def known_gestures(cfg: Dict[str, Any]) -> set:
    names = set(HAND_POSES + HAND_MOTIONS + FACE_GESTURES + HEAD_GESTURES + BODY_GESTURES)
    names.update(str(n).upper() for n in (cfg.get("face", {}).get("blendshape_gestures") or {}))
    return names


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge ``override`` into a copy of ``base``; lists are replaced."""
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def load_default_config() -> Dict[str, Any]:
    with open(DEFAULT_CONFIG_PATH, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def load_config(path: Optional[str] = None) -> Dict[str, Any]:
    cfg = load_default_config()
    if path:
        with open(path, "r", encoding="utf-8") as fh:
            user = yaml.safe_load(fh) or {}
        if not isinstance(user, dict):
            raise ValueError(f"{path}: top level must be a mapping")
        # A user-defined source list replaces the defaults entirely so that
        # removing e.g. the kinect entry actually removes it.
        sources = user.pop("sources", None)
        cfg = deep_merge(cfg, user)
        if sources is not None:
            defaults = load_default_config()["sources"]
            cfg["sources"] = {
                name: deep_merge(defaults.get(name, _type_defaults(defaults, spec)), spec or {})
                for name, spec in sources.items()
            }
    validate_config(cfg)
    return cfg


def _type_defaults(defaults: Dict[str, Any], spec: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Defaults for a user-named source: those of the built-in source of the same type."""
    kind = (spec or {}).get("type", "webcam")
    for candidate in defaults.values():
        if candidate.get("type") == kind:
            return candidate
    return {}


def validate_config(cfg: Dict[str, Any]) -> None:
    """Raise ``ValueError`` for mistakes that would otherwise fail later at runtime."""
    from .actions.keys import parse_keys  # local import: keeps config import light

    errors = []
    for name, src in (cfg.get("sources") or {}).items():
        if not isinstance(src, dict):
            errors.append(f"sources.{name}: must be a mapping")
            continue
        if src.get("type") not in ("webcam", "kinect_v2"):
            errors.append(f"sources.{name}.type: expected webcam or kinect_v2, got {src.get('type')!r}")
        for tracker in src.get("trackers") or []:
            if tracker not in TRACKERS:
                errors.append(f"sources.{name}.trackers: unknown tracker {tracker!r} (use {', '.join(TRACKERS)})")

    gestures = known_gestures(cfg)
    valid_actions = {
        "key", "key_hold", "type", "click", "mouse_hold", "scroll", "command", "log",
        "toggle_actions", "toggle_cursor", "calibrate_head",
    }
    for i, b in enumerate(cfg.get("bindings") or []):
        where = f"bindings[{i}]"
        if not isinstance(b, dict):
            errors.append(f"{where}: must be a mapping")
            continue
        gesture = str(b.get("gesture", "")).upper()
        if gesture not in gestures:
            errors.append(f"{where}: unknown gesture {b.get('gesture')!r}")
        action = b.get("action")
        if action not in valid_actions:
            errors.append(f"{where}: unknown action {action!r}")
        if b.get("hand", "any") not in ("any", "left", "right"):
            errors.append(f"{where}: hand must be any, left or right")
        if b.get("on", "start") not in ("start", "end", "trigger"):
            errors.append(f"{where}: on must be start, end or trigger")
        if action in ("key", "key_hold"):
            try:
                parse_keys(b.get("keys"))
            except ValueError as exc:
                errors.append(f"{where}: {exc}")
        if action in ("click", "mouse_hold") and b.get("button", "left") not in ("left", "right", "middle"):
            errors.append(f"{where}: button must be left, right or middle")
        if action == "command" and not b.get("cmd"):
            errors.append(f"{where}: command needs a cmd")

    cursor = cfg.get("cursor") or {}
    if cursor.get("mode", "hand") not in ("hand", "head"):
        errors.append("cursor.mode: expected hand or head")
    if cursor.get("point", "palm") not in ("palm", "index_tip", "wrist"):
        errors.append("cursor.point: expected palm, index_tip or wrist")
    if errors:
        raise ValueError("Invalid configuration:\n  " + "\n  ".join(errors))


def write_default_config(path: str) -> None:
    Path(path).write_text(DEFAULT_CONFIG_PATH.read_text(encoding="utf-8"), encoding="utf-8")
