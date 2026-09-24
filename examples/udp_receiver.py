"""Print what gesture_control streams over UDP.

    python -m gesture_control --udp 5005
    python examples/udp_receiver.py 5005

Every datagram is one JSON object: {"type": "event", ...} for gestures and
{"type": "tracking", ...} with landmarks / head pose for every processed frame.
The same few lines work from Unity (UdpClient), Godot (PacketPeerUDP),
TouchDesigner (UDP In DAT), Node.js (dgram) and so on.
"""

import json
import socket
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5005
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("127.0.0.1", port))
print(f"listening on udp://127.0.0.1:{port}")
while True:
    msg = json.loads(sock.recv(65535))
    if msg["type"] == "event":
        side = f" {msg['side']}" if msg["side"] else ""
        print(f"{msg['name']}{side} {msg['phase']} from {msg['source']} {msg['data']}")
    else:
        heads = [f["head"] for f in msg["faces"]]
        hands = [(h["side"], h["pose"]) for h in msg["hands"]]
        print(f"  [{msg['source']} #{msg['frame']}] hands={hands} head={heads}", end="\r")
