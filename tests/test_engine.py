from gesture_control.config import load_default_config
from gesture_control.gestures import GestureEngine
from gesture_control.types import END, START, TRIGGER, Body, Joint, Observation
from conftest import frame, hand_at

CFG = load_default_config()


def names(events):
    return [(e.name, e.phase, e.side) for e in events]


def test_pose_start_end_and_swipe_from_observations():
    engine = GestureEngine("cam", CFG, ["hands"])
    events = []
    for i in range(12):  # hold a fist
        obs = Observation("cam", frame(i / 30, i), hands=[hand_at("right", 0.5, 0.5, "FIST")])
        events += engine.update(obs)
    for i in range(12, 24):  # open the hand and sweep it to the right
        x = 0.3 + (i - 12) * 0.04
        obs = Observation("cam", frame(i / 30, i), hands=[hand_at("right", x, 0.5, "OPEN_PALM")])
        events += engine.update(obs)
    got = names(events)
    assert got[0] == ("FIST", START, "right")
    assert ("FIST", END, "right") in got and ("OPEN_PALM", START, "right") in got
    assert ("SWIPE_RIGHT", TRIGGER, "right") in got
    assert all(e.source == "cam" and e.category == "hand" for e in events)


def test_hand_disappearing_ends_pose():
    engine = GestureEngine("cam", CFG, ["hands"])
    events = []
    for i in range(10):
        events += engine.update(Observation("cam", frame(i / 30, i), hands=[hand_at("left", 0.5, 0.5, "POINT")]))
    for i in range(10, 20):
        events += engine.update(Observation("cam", frame(i / 30, i)))
    assert names(events) == [("POINT", START, "left"), ("POINT", END, "left")]


def test_release_all_ends_everything():
    engine = GestureEngine("cam", CFG, ["hands"])
    for i in range(10):
        engine.update(Observation("cam", frame(i / 30, i), hands=[hand_at("left", 0.5, 0.5, "PINCH")]))
    assert names(engine.release_all(1.0)) == [("PINCH", END, "left")]


def skeleton(t, u, z=2.0, state="open"):
    joints = {
        "SpineBase": Joint("SpineBase", (0, 0, z), (u, 700), True),
        "Head": Joint("Head", (0, 0.6, z), (960, 200), True),
        "HandRight": Joint("HandRight", (0.3, 0.1, z), (u, 500), True),
    }
    return Body(7, joints, {"left": "unknown", "right": state})


def test_skeleton_hands_produce_motion_gestures():
    engine = GestureEngine("kinect", CFG, ["body"])
    events = []
    for i in range(12):
        f = frame(i / 30, i, w=1920, h=1080, source="kinect")
        u = 600 + i * 60  # fast sweep right across the colour image
        events += engine.update(Observation("kinect", f, bodies=[skeleton(i / 30, u)]))
    got = names(events)
    assert ("HAND_OPEN", START, "right") in got
    assert ("SWIPE_RIGHT", TRIGGER, "right") in got
    assert all(e.category == "body" for e in events)


def test_skeleton_push_uses_metric_depth():
    engine = GestureEngine("kinect", CFG, ["body"])
    events = []
    for i in range(15):
        f = frame(i / 30, i, w=1920, h=1080, source="kinect")
        events += engine.update(Observation("kinect", f, bodies=[skeleton(i / 30, 960, z=2.0 - i * 0.02)]))
    assert ("PUSH", TRIGGER, "right") in names(events)
