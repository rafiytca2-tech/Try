"""Key-combination parsing that does not need a display (pynput is imported later)."""

from __future__ import annotations

from typing import List, Tuple, Union

# Friendly aliases -> pynput ``Key`` attribute names
ALIASES = {
    "control": "ctrl", "ctl": "ctrl", "lctrl": "ctrl_l", "rctrl": "ctrl_r",
    "option": "alt", "lalt": "alt_l", "ralt": "alt_r", "altgr": "alt_gr",
    "lshift": "shift_l", "rshift": "shift_r",
    "win": "cmd", "windows": "cmd", "super": "cmd", "meta": "cmd", "command": "cmd",
    "return": "enter", "escape": "esc", "del": "delete", "ins": "insert",
    "pgup": "page_up", "pageup": "page_up", "pgdn": "page_down", "pagedown": "page_down",
    "arrow_up": "up", "arrow_down": "down", "arrow_left": "left", "arrow_right": "right",
    "volume_up": "media_volume_up", "volup": "media_volume_up",
    "volume_down": "media_volume_down", "voldown": "media_volume_down",
    "mute": "media_volume_mute", "volume_mute": "media_volume_mute",
    "play_pause": "media_play_pause", "playpause": "media_play_pause", "play": "media_play_pause",
    "next_track": "media_next", "next": "media_next",
    "prev_track": "media_previous", "previous_track": "media_previous", "prev": "media_previous",
    "printscreen": "print_screen", "prtsc": "print_screen", "capslock": "caps_lock",
    "numlock": "num_lock", "scrolllock": "scroll_lock",
    "spacebar": "space", "plus": "+", "minus": "-",
}

# pynput Key names that exist on every platform (plus f1-f20)
SPECIAL_KEYS = {
    "alt", "alt_l", "alt_r", "alt_gr", "backspace", "caps_lock", "cmd", "cmd_l", "cmd_r",
    "ctrl", "ctrl_l", "ctrl_r", "delete", "down", "end", "enter", "esc", "home", "left",
    "page_down", "page_up", "right", "shift", "shift_l", "shift_r", "space", "tab", "up",
    "media_play_pause", "media_volume_mute", "media_volume_down", "media_volume_up",
    "media_previous", "media_next", "insert", "menu", "num_lock", "pause",
    "print_screen", "scroll_lock",
} | {f"f{i}" for i in range(1, 21)}

MODIFIERS = {"alt", "alt_l", "alt_r", "alt_gr", "cmd", "cmd_l", "cmd_r", "ctrl", "ctrl_l",
             "ctrl_r", "shift", "shift_l", "shift_r"}

Combo = Tuple[str, ...]


def normalize_key(token: str) -> str:
    raw = token.strip()
    if len(raw) == 1:
        return raw.lower() if raw.isalpha() else raw
    name = raw.lower().replace(" ", "_").replace("-", "_")
    name = ALIASES.get(name, name)
    if len(name) == 1 or name in SPECIAL_KEYS:
        return name
    raise ValueError(f"unknown key {token!r}")


def parse_combo(spec: str) -> Combo:
    """``"ctrl+shift+t"`` -> ``("ctrl", "shift", "t")``.  ``"+"`` alone is the plus key."""
    spec = str(spec).strip()
    if not spec:
        raise ValueError("empty key combination")
    if spec == "+":
        return ("+",)
    parts = spec.split("+")
    # "ctrl++" means ctrl and the plus key
    if spec.endswith("++"):
        parts = parts[:-2] + ["+"]
    return tuple(normalize_key(p) for p in parts if p != "" or len(parts) == 1)


def parse_keys(spec: Union[str, List[str], None]) -> List[Combo]:
    """A single combination or a list of combinations tapped in sequence."""
    if spec is None or spec == "" or spec == []:
        raise ValueError("keys is required")
    if isinstance(spec, (list, tuple)):
        return [parse_combo(s) for s in spec]
    return [parse_combo(spec)]
