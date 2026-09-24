import pytest

from conftest import make_hand, to_image
from gesture_control.gestures.hand_pose import classify, straightness, thumb_direction

ALL = ("index", "middle", "ring", "pinky")


@pytest.mark.parametrize("extended, thumb, expected", [
    (ALL, "out", "OPEN_PALM"),
    (ALL, "tucked", "FOUR"),
    ((), "tucked", "FIST"),
    (("index",), "tucked", "POINT"),
    (("index",), "out", "POINT"),
    (("index", "middle"), "tucked", "VICTORY"),
    (("index", "middle", "ring"), "tucked", "THREE"),
    (("index", "pinky"), "tucked", "ROCK"),
    (("index", "pinky"), "out", "ROCK"),
    (("pinky",), "out", "CALL_ME"),
])
def test_static_poses(extended, thumb, expected):
    world = make_hand(extended, thumb)
    result = classify(world, to_image(world))
    assert result.pose == expected
    assert result.count == len(extended) + (thumb == "out")


def test_thumbs_up_and_down():
    up = make_hand((), "along", orient="side")
    assert classify(up, to_image(up)).pose == "THUMBS_UP"
    down = make_hand((), "along", orient="side_down")
    assert classify(down, to_image(down)).pose == "THUMBS_DOWN"


def test_thumb_out_sideways_with_fist_is_fist():
    world = make_hand((), "out")
    assert thumb_direction(to_image(world)) is None
    assert classify(world, to_image(world)).pose == "FIST"


def test_pinch_and_ok():
    pinch = make_hand((), pinch_with_index=True)
    result = classify(pinch, to_image(pinch))
    assert result.pose == "PINCH"
    assert result.pinch < 0.1
    ok = make_hand(("middle", "ring", "pinky"), pinch_with_index=True)
    assert classify(ok, to_image(ok)).pose == "OK"


def test_pose_is_scale_and_rotation_invariant():
    import numpy as np

    world = make_hand(("index", "middle"), "tucked")
    angle = np.radians(37)
    rot = np.array([[np.cos(angle), -np.sin(angle), 0], [np.sin(angle), np.cos(angle), 0], [0, 0, 1]])
    turned = (world @ rot.T) * 1.8
    assert classify(turned, to_image(turned)).pose == "VICTORY"


def test_straightness_extremes():
    from gesture_control.gestures.hand_pose import FINGERS

    straight = make_hand(ALL, "out")
    curled = make_hand((), "tucked")
    assert straightness(straight, FINGERS["index"]) > 0.95
    assert straightness(curled, FINGERS["index"]) < 0.6
