"""Reading Kinect depth at image positions."""

from __future__ import annotations

from typing import Optional

import numpy as np


def depth_at(depth: Optional[np.ndarray], x: float, y: float, radius: int = 2) -> Optional[float]:
    """Median depth (mm) around normalised image position ``(x, y)``.

    ``depth`` is colour-aligned but may be lower resolution than the colour
    image, which is why positions are normalised.  Returns None when there is
    no valid depth nearby.
    """
    if depth is None or not np.isfinite(x) or not np.isfinite(y):
        return None
    h, w = depth.shape[:2]
    cx = int(np.clip(x, 0.0, 1.0) * (w - 1) + 0.5)
    cy = int(np.clip(y, 0.0, 1.0) * (h - 1) + 0.5)
    patch = depth[max(0, cy - radius):cy + radius + 1, max(0, cx - radius):cx + radius + 1]
    valid = patch[(patch > 0) & np.isfinite(patch)]
    if valid.size == 0:
        return None
    return float(np.median(valid))
