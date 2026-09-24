"""JSON-over-UDP stream of events and tracking data for other programs."""

from __future__ import annotations

import json
import logging
import socket
from typing import Any, Dict

log = logging.getLogger(__name__)


class UdpPublisher:
    """Sends one JSON object per datagram to ``host:port``.

    Messages have ``"type": "event"`` (see ``GestureEvent.to_dict``) or
    ``"type": "tracking"`` (see ``Observation.to_dict``).
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 5005, tracking: bool = True):
        self.address = (host, int(port))
        self.tracking = tracking
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._warned = False
        log.info("Streaming %s to udp://%s:%d", "events + tracking" if tracking else "events", host, port)

    def send(self, message: Dict[str, Any]) -> None:
        try:
            self.sock.sendto(json.dumps(message, separators=(",", ":")).encode("utf-8"), self.address)
        except OSError as exc:
            if not self._warned:
                log.warning("UDP send failed: %s", exc)
                self._warned = True

    def close(self) -> None:
        self.sock.close()
