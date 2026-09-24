"""Signal smoothing helpers."""

from __future__ import annotations

import math
from typing import Optional


class OneEuroFilter:
    """The 1€ filter (Casiez et al. 2012): low jitter when still, low lag when moving.

    ``min_cutoff`` (Hz) sets smoothing at rest, ``beta`` how quickly the cutoff
    rises with speed.  Works on floats and on numpy arrays (element-wise).
    """

    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.0, d_cutoff: float = 1.0):
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.reset()

    def reset(self) -> None:
        self._x = None
        self._dx = 0.0
        self._t: Optional[float] = None

    @staticmethod
    def _alpha(dt: float, cutoff):
        tau = 1.0 / (2.0 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, t: float):
        if self._t is None or self._x is None:
            self._x, self._t = x, t
            return x
        dt = t - self._t
        if dt <= 0:
            return self._x
        dx = (x - self._x) / dt
        a_d = self._alpha(dt, self.d_cutoff)
        self._dx = a_d * dx + (1 - a_d) * self._dx
        cutoff = self.min_cutoff + self.beta * abs(self._dx)
        a = self._alpha(dt, cutoff)
        self._x = a * x + (1 - a) * self._x
        self._t = t
        return self._x
