from gesture_control.gestures.signal import Debounced, Hysteresis, StateBank, zigzag_legs
from gesture_control.types import END, START


def test_zigzag_counts_strokes():
    assert zigzag_legs([0, 10, 0, 10], 5) == [10, -10, 10]
    assert zigzag_legs([0, -10, 0], 5) == [-10, 10]


def test_zigzag_ignores_small_moves():
    assert zigzag_legs([0, 2, -1, 3, 0, 1], 5) == []
    assert zigzag_legs([5, 0, 10], 8) == [10]  # the first 5-point dip is below threshold
    assert zigzag_legs([], 1) == []


def test_zigzag_with_noise():
    import math

    values = [10 * math.sin(i / 3) + (0.5 if i % 2 else -0.5) for i in range(40)]
    assert len(zigzag_legs(values, 8)) >= 5


def test_hysteresis():
    h = Hysteresis(0.6, 0.4)
    assert [h.update(v) for v in (0.5, 0.65, 0.5, 0.41, 0.39, 0.5)] == [False, True, True, True, False, False]
    assert h.update(None) is False


def test_debounced_min_on_and_off():
    d = Debounced(min_on=0.2, min_off=0.1)
    assert d.update(True, 0.0) is None
    assert d.update(True, 0.1) is None
    assert d.update(True, 0.2) == START
    assert d.update(False, 0.25) is None
    assert d.update(True, 0.3) is None       # blip shorter than min_off: still active
    assert d.update(False, 0.4) is None
    assert d.update(False, 0.5) == END


def test_debounced_zero_delay():
    d = Debounced()
    assert d.update(True, 0) == START
    assert d.update(False, 0) == END


def test_state_bank_release_all():
    bank = StateBank(0, 0)
    bank.update("a", True, 0)
    bank.update("b", False, 0)
    assert bank.active_keys() == ["a"]
    assert bank.release_all() == [("a", END)]
    assert not bank.is_active("a")
