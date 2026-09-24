"""Command line entry point: ``python -m gesture_control``."""

from __future__ import annotations

import argparse
import logging
import sys
from typing import List, Optional

from . import __version__
from .config import load_config, validate_config, write_default_config


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="gesture_control",
        description="Hand, face, head and gesture control from a Kinect v2 and a webcam.",
    )
    p.add_argument("-c", "--config", help="YAML config file (defaults are used for anything missing)")
    p.add_argument("--write-config", metavar="PATH", help="write the default config to PATH and exit")
    p.add_argument("--no-webcam", action="store_true", help="disable webcam sources")
    p.add_argument("--no-kinect", action="store_true", help="disable Kinect sources")
    p.add_argument("--webcam", metavar="DEVICE", help="webcam index, video file or stream URL")
    p.add_argument("--kinect-backend", choices=["auto", "pykinect2", "libfreenect2", "uvc"])
    p.add_argument("--cursor", choices=["hand", "head"], help="start with mouse-pointer control on")
    p.add_argument("--dry-run", action="store_true", help="log actions instead of pressing keys")
    p.add_argument("--paused", action="store_true", help="start with actions paused (P toggles)")
    p.add_argument("--no-display", action="store_true", help="run without the preview window")
    p.add_argument("--udp", metavar="[HOST:]PORT", help="stream events/tracking as JSON over UDP")
    p.add_argument("--check", action="store_true", help="show available cameras, drivers and models")
    p.add_argument("--list-cameras", action="store_true", help="list webcam indices and exit")
    p.add_argument("--download-models", action="store_true", help="download the MediaPipe models and exit")
    p.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def apply_overrides(cfg: dict, args: argparse.Namespace) -> dict:
    sources = cfg.setdefault("sources", {})
    for spec in sources.values():
        kind = spec.get("type")
        if args.no_webcam and kind == "webcam":
            spec["enabled"] = False
        if args.no_kinect and kind == "kinect_v2":
            spec["enabled"] = False
        if args.kinect_backend and kind == "kinect_v2":
            spec["backend"] = args.kinect_backend
    if args.webcam is not None:
        webcams = [s for s in sources.values() if s.get("type") == "webcam"]
        if webcams:
            webcams[0]["device"] = args.webcam
            webcams[0]["enabled"] = True
        else:
            sources["webcam"] = {"type": "webcam", "device": args.webcam, "mirror": True,
                                 "trackers": ["hands", "face"]}
    if args.cursor:
        cfg["cursor"]["enabled"] = True
        cfg["cursor"]["mode"] = args.cursor
    if args.dry_run:
        cfg["actions"]["dry_run"] = True
    if args.paused:
        cfg["actions"]["enabled"] = False
    if args.no_display:
        cfg["display"]["enabled"] = False
    if args.udp:
        host, _, port = args.udp.rpartition(":")
        cfg["output"]["udp"].update({"enabled": True, "host": host or "127.0.0.1", "port": int(port)})
    validate_config(cfg)
    return cfg


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("gesture_control")

    if args.write_config:
        write_default_config(args.write_config)
        print(f"Wrote {args.write_config}. Edit it, then run with --config {args.write_config}")
        return 0
    try:
        cfg = apply_overrides(load_config(args.config), args)
    except (OSError, ValueError) as exc:
        log.error("%s", exc)
        return 2

    if args.list_cameras:
        from .diagnostics import list_cameras

        cams = list_cameras()
        for index, w, h in cams:
            print(f"camera {index}: {w}x{h}")
        if not cams:
            print("no cameras found")
        return 0
    if args.check:
        from .diagnostics import run_checks

        return run_checks(cfg)
    if args.download_models:
        from .models import MODELS, ensure_model, models_dir

        for kind in MODELS:
            print(ensure_model(kind, models_dir(cfg.get("models_dir"))))
        return 0

    from .app import run

    try:
        return run(cfg)
    except RuntimeError as exc:
        log.error("%s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
