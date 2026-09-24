from gesture_control.fusion import EventFusion
from gesture_control.gestures.body_gestures import BodyGestures, nearest_body
from gesture_control.types import END, START, TRIGGER, Body, GestureEvent, Joint


def ev(name, phase, source, t, side=None):
    return GestureEvent(name, "hand", phase, source, t, side)


def test_trigger_from_two_cameras_counts_once():
    f = EventFusion(window=0.4)
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "webcam", 1.0))
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "kinect", 1.2)) == []
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "kinect", 1.7))  # outside the window


def test_same_camera_repeats_are_kept():
    f = EventFusion(window=0.4)
    assert f.process(ev("BLINK", TRIGGER, "webcam", 1.0))
    assert f.process(ev("BLINK", TRIGGER, "webcam", 1.2))


def test_sides_are_independent():
    f = EventFusion(window=0.4)
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "webcam", 1.0, "left"))
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "kinect", 1.1, "right"))


def test_held_states_are_or_combined():
    f = EventFusion()
    assert f.process(ev("FIST", START, "webcam", 1.0, "right"))
    assert f.process(ev("FIST", START, "kinect", 1.1, "right")) == []
    assert f.process(ev("FIST", END, "webcam", 1.5, "right")) == []   # kinect still sees it
    out = f.process(ev("FIST", END, "kinect", 1.6, "right"))
    assert [e.phase for e in out] == [END]
    assert f.process(ev("FIST", END, "kinect", 1.7, "right")) == []   # stray END ignored


def test_drop_source_ends_its_states():
    f = EventFusion()
    f.process(ev("PINCH", START, "webcam", 1.0, "right"))
    ended = f.drop_source("webcam", 2.0)
    assert [(e.name, e.phase, e.side) for e in ended] == [("PINCH", END, "right")]


def test_disabled_fusion_passes_everything():
    f = EventFusion(enabled=False)
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "webcam", 1.0))
    assert f.process(ev("SWIPE_LEFT", TRIGGER, "kinect", 1.0))


def body(tracking_id=1, z=2.0, left_y=0.0, right_y=0.0, head_y=0.5, left="unknown", right="unknown"):
    joints = {
        "SpineBase": Joint("SpineBase", (0, 0, z), (320, 300), True),
        "Head": Joint("Head", (0, head_y, z), (320, 100), True),
        "HandLeft": Joint("HandLeft", (-0.3, left_y, z), (200, 200), True),
        "HandRight": Joint("HandRight", (0.3, right_y, z), (440, 200), True),
    }
    return Body(tracking_id, joints, {"left": left, "right": right})


def run_body(frames):
    bg = BodyGestures({"raise_margin": 0.05, "min_on": 0.2, "hand_state_min_on": 0.1})
    out = []
    for i, bodies in enumerate(frames):
        out += [(n, p, s) for n, p, s, _ in bg.update(bodies, i / 30)]
    return out


def test_nearest_body_wins():
    near, far = body(1, z=1.5), body(2, z=3.0)
    assert nearest_body([far, near]).tracking_id == 1
    assert nearest_body([]) is None


def test_raise_hand_and_both_hands_up():
    events = run_body([[body(right_y=0.7)]] * 10)
    assert ("RAISE_HAND", START, "right") in events and ("BOTH_HANDS_UP", START, None) not in events
    events = run_body([[body(left_y=0.8, right_y=0.8)]] * 10)
    assert ("BOTH_HANDS_UP", START, None) in events


def test_kinect_hand_states_survive_short_unknown_gaps():
    frames = [[body(right="closed")]] * 6 + [[body(right="unknown")]] * 3 + [[body(right="closed")]] * 3
    events = run_body(frames)
    assert events.count(("HAND_CLOSED", START, "right")) == 1
    assert ("HAND_CLOSED", END, "right") not in events
    events = run_body(frames + [[]])
    assert ("HAND_CLOSED", END, "right") in events  # person left
