from gesture_control.config import load_default_config
from gesture_control.gestures.hand_motion import HandMotion, Sample

CFG = load_default_config()["hands"]


def run(samples, cfg=CFG):
    motion = HandMotion(cfg)
    found = []
    for s in samples:
        found += [name for name, _ in motion.update(s)]
    return found


def line(x0, y0, x1, y1, duration, n=12, t0=0.0, scale=None, depth=None, pose="OPEN_PALM"):
    out = []
    for i in range(n):
        f = i / (n - 1)
        out.append(Sample(t0 + f * duration, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f,
                          scale(f) if callable(scale) else scale,
                          depth(f) if callable(depth) else depth, pose))
    return out


def test_swipes_in_all_directions():
    assert run(line(0.2, 0.3, 0.6, 0.3, 0.3)) == ["SWIPE_RIGHT"]
    assert run(line(0.7, 0.3, 0.3, 0.3, 0.3)) == ["SWIPE_LEFT"]
    assert run(line(0.5, 0.1, 0.5, 0.45, 0.3)) == ["SWIPE_DOWN"]
    assert run(line(0.5, 0.45, 0.5, 0.1, 0.3)) == ["SWIPE_UP"]


def test_slow_drift_is_not_a_swipe():
    assert run(line(0.2, 0.3, 0.6, 0.3, 2.5, n=75)) == []


def test_diagonal_is_not_a_swipe():
    assert run(line(0.2, 0.1, 0.5, 0.4, 0.3)) == []


def test_swipe_cooldown():
    first = line(0.2, 0.3, 0.6, 0.3, 0.3)
    back = line(0.6, 0.3, 0.2, 0.3, 0.3, t0=0.35)
    assert run(first + back) == ["SWIPE_RIGHT"]  # the return stroke falls in the cooldown


def test_swipe_pose_filter():
    cfg = {**CFG, "swipe": {**CFG["swipe"], "poses": ["POINT"]}}
    assert run(line(0.2, 0.3, 0.6, 0.3, 0.3, pose="OPEN_PALM"), cfg) == []
    assert run(line(0.2, 0.3, 0.6, 0.3, 0.3, pose="POINT"), cfg) == ["SWIPE_RIGHT"]


def test_push_and_pull_with_depth():
    assert run(line(0.5, 0.4, 0.5, 0.4, 0.4, depth=lambda f: 900 - 200 * f)) == ["PUSH"]
    assert run(line(0.5, 0.4, 0.5, 0.4, 0.4, depth=lambda f: 700 + 200 * f)) == ["PULL"]
    assert run(line(0.5, 0.4, 0.5, 0.4, 0.4, depth=lambda f: 900 - 60 * f)) == []


def test_push_from_apparent_size_without_depth():
    assert run(line(0.5, 0.4, 0.5, 0.4, 0.4, scale=lambda f: 0.05 * (1 + 0.5 * f))) == ["PUSH"]
    assert run(line(0.5, 0.4, 0.5, 0.4, 0.4, scale=lambda f: 0.08 * (1 - 0.4 * f))) == ["PULL"]


def test_size_change_during_pose_change_is_ignored():
    samples = line(0.5, 0.4, 0.5, 0.4, 0.4, scale=lambda f: 0.05 * (1 + 0.5 * f))
    for i, s in enumerate(samples):  # the hand closes half way through growing
        s.pose = "OPEN_PALM" if i < len(samples) // 2 else "FIST"
    assert run(samples) == []


def test_wave():
    import math

    samples = [Sample(i / 30, 0.5 + 0.06 * math.sin(i / 30 * 2 * math.pi * 2.5), 0.3, None, None, "OPEN_PALM")
               for i in range(45)]
    assert run(samples) == ["WAVE"]


def test_wave_needs_open_hand():
    import math

    samples = [Sample(i / 30, 0.5 + 0.06 * math.sin(i / 30 * 2 * math.pi * 2.5), 0.3, None, None, "FIST")
               for i in range(45)]
    assert "WAVE" not in run(samples)


def test_history_resets_after_hand_lost():
    motion = HandMotion(CFG)
    motion.update(Sample(0.0, 0.2, 0.3, None, None, None))
    motion.update(Sample(0.05, 0.25, 0.3, None, None, None))
    # hand reappears 1 s later on the other side: not a swipe
    assert motion.update(Sample(1.05, 0.8, 0.3, None, None, None)) == []
    assert len(motion.history) == 1
