import pytest

from gesture_control.actions import ActionExecutor, CursorController, DryRunBackend
from gesture_control.actions.cursor import joystick, map_region
from gesture_control.actions.keys import parse_combo, parse_keys
from gesture_control.types import END, START, TRIGGER, GestureEvent, HeadPose, Observation
from conftest import face_obs, frame, hand_at


def ev(name, phase=TRIGGER, t=1.0, side=None, source="webcam"):
    return GestureEvent(name, "hand", phase, source, t, side)


def make(bindings, **kw):
    backend = DryRunBackend(verbose=False)
    return ActionExecutor(bindings, backend, **kw), backend


def test_key_parsing():
    assert parse_combo("ctrl+shift+t") == ("ctrl", "shift", "t")
    assert parse_combo("Control+Alt+Delete") == ("ctrl", "alt", "delete")
    assert parse_combo("win+d") == ("cmd", "d")
    assert parse_combo("volume_up") == ("media_volume_up",)
    assert parse_combo("ctrl++") == ("ctrl", "+")
    assert parse_combo("A") == ("a",)
    assert parse_keys(["left", "enter"]) == [("left",), ("enter",)]
    with pytest.raises(ValueError):
        parse_combo("ctrl+nosuchkey")


def test_key_tap_on_trigger_and_start():
    ex, be = make([{"gesture": "SWIPE_LEFT", "action": "key", "keys": "left"}])
    assert ex.handle(ev("SWIPE_LEFT"))
    assert be.calls == [("tap", "left")]
    ex, be = make([{"gesture": "FIST", "action": "key", "keys": "space"}])
    ex.handle(ev("FIST", START))
    ex.handle(ev("FIST", END))
    assert be.calls == [("tap", "space")]


def test_on_end():
    ex, be = make([{"gesture": "FIST", "action": "key", "keys": "a", "on": "end"}])
    ex.handle(ev("FIST", START))
    assert be.calls == []
    ex.handle(ev("FIST", END))
    assert be.calls == [("tap", "a")]


def test_hold_actions_press_and_release():
    ex, be = make([{"gesture": "PINCH", "action": "mouse_hold", "button": "left"},
                   {"gesture": "FIST", "action": "key_hold", "keys": "shift"}])
    ex.handle(ev("PINCH", START, side="right"))
    ex.handle(ev("FIST", START, side="left"))
    ex.handle(ev("PINCH", END, side="right"))
    assert be.calls == [("mouse_down", "left"), ("press", "shift"), ("mouse_up", "left")]
    ex.release_all()
    assert be.calls[-1] == ("release", "shift")


def test_hold_action_on_momentary_gesture_taps():
    ex, be = make([{"gesture": "PUSH", "action": "mouse_hold"}])
    ex.handle(ev("PUSH"))
    assert be.calls == [("mouse_down", "left"), ("mouse_up", "left")]


def test_filters_by_hand_and_source():
    ex, be = make([{"gesture": "POINT", "hand": "right", "source": "kinect", "action": "click"}])
    ex.handle(ev("POINT", START, side="left", source="kinect"))
    ex.handle(ev("POINT", START, side="right", source="webcam"))
    assert be.calls == []
    ex.handle(ev("POINT", START, side="right", source="kinect"))
    assert be.calls == [("click", "left", 1)]


def test_cooldown():
    ex, be = make([{"gesture": "NOD", "action": "key", "keys": "y", "cooldown": 1.0}])
    for t in (1.0, 1.5, 2.1):
        ex.handle(ev("NOD", t=t))
    assert be.calls == [("tap", "y"), ("tap", "y")]


def test_pause_blocks_actions_but_not_toggle():
    ex, be = make([{"gesture": "ROCK", "action": "toggle_actions"},
                   {"gesture": "SWIPE_LEFT", "action": "key", "keys": "left"},
                   {"gesture": "FIST", "action": "mouse_hold"}], enabled=True)
    ex.handle(ev("FIST", START, side="right"))
    ex.handle(ev("ROCK", START, t=2.0))          # pause: held button is released
    assert not ex.enabled and be.calls[-1] == ("mouse_up", "left")
    ex.handle(ev("SWIPE_LEFT", t=3.0))
    assert ("tap", "left") not in be.calls
    ex.handle(ev("ROCK", START, t=4.0))
    ex.handle(ev("SWIPE_LEFT", t=5.0))
    assert be.calls[-1] == ("tap", "left")


def test_requires_cursor():
    active = {"on": False}
    ex, be = make([{"gesture": "PINCH", "action": "mouse_hold", "requires_cursor": True}],
                  cursor_active=lambda: active["on"])
    ex.handle(ev("PINCH", START))
    assert be.calls == []
    active["on"] = True
    ex.handle(ev("PINCH", START, t=2))
    assert be.calls == [("mouse_down", "left")]


def test_callbacks():
    calls = []
    ex, _ = make([{"gesture": "OK", "action": "toggle_cursor"}, {"gesture": "NOD", "action": "calibrate_head"}],
                 on_toggle_cursor=lambda: calls.append("cursor"), on_calibrate_head=lambda: calls.append("head"))
    ex.handle(ev("OK", START))
    ex.handle(ev("NOD"))
    assert calls == ["cursor", "head"]


def test_map_region_and_joystick():
    assert map_region(0.5, 0.45, (0.2, 0.15, 0.8, 0.75)) == pytest.approx((0.5, 0.5))
    assert map_region(0.0, 1.0, (0.2, 0.15, 0.8, 0.75)) == (0.0, 1.0)
    assert joystick(3, 4, 20) == 0.0
    assert joystick(12, 4, 20) == pytest.approx(0.5)
    assert joystick(-40, 4, 20) == -1.0


def cursor(**cfg):
    backend = DryRunBackend(verbose=False)
    base = {"enabled": True, "mode": "hand", "hand": "right", "point": "palm",
            "region": [0.0, 0.0, 1.0, 1.0], "pause_pose": "FIST", "min_cutoff": 1000, "beta": 0}
    base.update(cfg)
    return CursorController(base, backend, (1000, 500)), backend


def hand_obs(t, index, x, y, pose="OPEN_PALM"):
    return Observation("cam", frame(t, index), hands=[hand_at("right", x, y, pose)])


def test_hand_cursor_moves_to_mapped_position():
    c, be = cursor()
    c.update({"cam": hand_obs(0.0, 0, 0.25, 0.5)})
    c.update({"cam": hand_obs(0.033, 1, 0.75, 0.5)})
    assert be.calls[-1][0] == "move_to"
    assert be.calls[-1][1] == pytest.approx(0.75 * 999, abs=5)  # a little smoothing lag
    c.update({"cam": hand_obs(0.033, 1, 0.1, 0.1)})   # same frame again: ignored
    assert len(be.calls) == 2


def test_hand_cursor_pause_pose_and_disabled():
    c, be = cursor()
    c.update({"cam": hand_obs(0.0, 0, 0.5, 0.5, pose="FIST")})
    assert be.calls == [] and c.status == "paused"
    c.toggle()
    c.update({"cam": hand_obs(0.1, 1, 0.5, 0.5)})
    assert be.calls == []


def test_head_cursor_relative():
    c, be = cursor(mode="head", head_mode="relative", head_speed=1000, head_deadzone=0, head_range=[20, 10])
    c.update({"cam": face_obs(0.0, 0, head=HeadPose(20, 0, 0))})
    c.update({"cam": face_obs(0.1, 1, head=HeadPose(20, -10, 0))})
    kind, dx, dy = be.calls[-1]
    assert kind == "move_by" and dx == pytest.approx(100, abs=1) and dy == pytest.approx(100, abs=1)


def test_head_cursor_absolute():
    c, be = cursor(mode="head", head_mode="absolute", head_range=[20, 10])
    c.update({"cam": face_obs(0.0, 0, head=HeadPose(-20, 10, 0))})
    assert be.calls[-1] == ("move_to", 0, 0)


def test_hand_cursor_falls_back_to_kinect_skeleton():
    from gesture_control.types import Body, Joint

    c, be = cursor()
    hand = Joint("HandRight", (0.3, 0.1, 2.5), (480.0, 120.0), True)
    obs = Observation("kinect", frame(0.0, 0, w=640, h=480), bodies=[Body(1, {"HandRight": hand}, {})])
    c.update({"kinect": obs})
    assert be.calls == [("move_to", round(0.75 * 999), round(0.25 * 499))]
