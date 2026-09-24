"""The application: one worker thread per camera, events fused and dispatched
to actions on the main thread, plus the preview window."""

from __future__ import annotations

import logging
import queue
import signal
import threading
import time
from collections import deque
from pathlib import Path
from typing import Deque, Dict, Optional, Tuple

from .actions import ActionExecutor, CursorController, create_backend
from .actions.backends import enable_dpi_awareness, screen_size
from .fusion import EventFusion
from .models import ensure_model, models_dir
from .output import UdpPublisher
from .types import GestureEvent, Observation

log = logging.getLogger(__name__)

WINDOW = "Gesture Control"
HELP = "Q quit  P pause actions  K cursor  C calibrate head  D depth  M mesh"


class SourceWorker(threading.Thread):
    """Capture -> perception -> gestures for one camera, on its own thread."""

    def __init__(self, name: str, spec: Dict, cfg: Dict, model_paths: Dict[str, Path],
                 events: "queue.Queue[GestureEvent]"):
        super().__init__(name=f"worker-{name}", daemon=True)
        self.source_name = name
        self.spec = spec
        self.cfg = cfg
        self.model_paths = model_paths
        self.events = events
        self.latest: Optional[Observation] = None
        self.error: Optional[str] = None
        self.description = name
        self.finished = threading.Event()
        self.ready = threading.Event()
        self._stop_event = threading.Event()
        self._calibrate = False

    def stop(self) -> None:
        self._stop_event.set()

    def calibrate(self) -> None:
        self._calibrate = True

    def run(self) -> None:
        from .gestures import GestureEngine
        from .perception.pipeline import Perception
        from .sources import create_source

        source = perception = engine = None
        try:
            source = create_source(self.source_name, self.spec)
            source.start()
            self.description = source.describe()
            perception = Perception(self.spec, self.cfg, self.model_paths)
            engine = GestureEngine(self.source_name, self.cfg, self.spec.get("trackers") or [])
        except Exception as exc:
            self.error = str(exc)
            log.error("%s: %s", self.source_name, exc)
            if source is not None:
                source.stop()
            self.ready.set()
            self.finished.set()
            return
        self.ready.set()
        fps = 0.0
        last_t: Optional[float] = None
        try:
            while not self._stop_event.is_set():
                frame = source.read(timeout=0.5)
                if frame is None:
                    if source.finished:
                        if source.error:
                            self.error = source.error
                        break
                    continue
                if self._calibrate:
                    perception.request_calibration()
                    self._calibrate = False
                started = time.perf_counter()
                obs = perception.process(frame)
                obs.events = engine.update(obs)
                obs.latency_ms = (time.perf_counter() - started) * 1000
                if last_t is not None and frame.timestamp > last_t:
                    inst = 1.0 / (frame.timestamp - last_t)
                    fps = inst if fps == 0 else 0.9 * fps + 0.1 * inst
                last_t = frame.timestamp
                obs.fps = fps
                self.latest = obs
                for event in obs.events:
                    self.events.put(event)
        except Exception as exc:
            self.error = f"{type(exc).__name__}: {exc}"
            log.exception("%s worker crashed", self.source_name)
        finally:
            if engine is not None:
                for event in engine.release_all(time.monotonic()):
                    self.events.put(event)
            if perception is not None:
                perception.close()
            source.stop()
            self.finished.set()


class App:
    def __init__(self, cfg: Dict):
        self.cfg = cfg
        self.display = bool(cfg.get("display", {}).get("enabled", True))
        self.show_depth = bool(cfg.get("display", {}).get("show_depth", False))
        self.show_mesh = bool(cfg.get("display", {}).get("show_face_mesh", True))
        self.display_height = int(cfg.get("display", {}).get("height", 480))
        self.events: "queue.Queue[GestureEvent]" = queue.Queue()
        self.recent: Deque[Tuple[float, str]] = deque(maxlen=30)
        self.log_events = bool(cfg.get("output", {}).get("log_events", True))

        sources = {n: s for n, s in (cfg.get("sources") or {}).items() if s.get("enabled", True)}
        if not sources:
            raise RuntimeError("No sources enabled. Enable a webcam or the Kinect in the config.")
        model_paths = self._models(sources, cfg.get("models_dir"))
        self.workers = [SourceWorker(n, s, cfg, model_paths, self.events) for n, s in sources.items()]

        actions_cfg = cfg.get("actions", {})
        enable_dpi_awareness()
        self.backend = create_backend(bool(actions_cfg.get("dry_run", False)))
        cursor_cfg = cfg.get("cursor", {})
        self.cursor = CursorController(cursor_cfg, self.backend,
                                       screen=lambda: screen_size(cursor_cfg.get("screen")))
        self.executor = ActionExecutor(
            cfg.get("bindings") or [],
            self.backend,
            enabled=bool(actions_cfg.get("enabled", True)),
            cursor_active=lambda: self.cursor.active,
            on_toggle_cursor=self.cursor.toggle,
            on_calibrate_head=self.calibrate_head,
        )
        fusion_cfg = cfg.get("fusion", {})
        self.fusion = EventFusion(float(fusion_cfg.get("window", 0.4)), bool(fusion_cfg.get("enabled", True)))
        udp_cfg = cfg.get("output", {}).get("udp", {})
        self.udp = None
        if udp_cfg.get("enabled"):
            self.udp = UdpPublisher(udp_cfg.get("host", "127.0.0.1"), int(udp_cfg.get("port", 5005)),
                                    bool(udp_cfg.get("tracking", True)))
        self._sent_frames: Dict[str, int] = {}
        self._reported_dead: set = set()

    @staticmethod
    def _models(sources: Dict[str, Dict], directory: Optional[str]) -> Dict[str, Path]:
        wanted = set()
        for spec in sources.values():
            trackers = set(spec.get("trackers") or [])
            if "hands" in trackers:
                wanted.add("hand")
            if "face" in trackers:
                wanted.add("face")
        return {kind: ensure_model(kind, models_dir(directory)) for kind in sorted(wanted)}

    def calibrate_head(self) -> None:
        for worker in self.workers:
            worker.calibrate()
        self._note("head pose calibrated")

    def _note(self, line: str) -> None:
        self.recent.append((time.monotonic(), line))

    # ------------------------------------------------------------------ loop
    def run(self) -> int:
        for worker in self.workers:
            worker.start()
        for worker in self.workers:
            worker.ready.wait(timeout=30)
        alive = [w for w in self.workers if not w.error]
        if not alive:
            log.error("No camera could be started.")
            return 1
        for w in alive:
            log.info("Running: %s (trackers: %s)", w.description, ", ".join(w.spec.get("trackers") or []))
        if self.cursor.active:
            log.info("Cursor control ON (%s mode)", self.cursor.mode)

        self._quit = False
        previous = self._install_sigterm()
        try:
            while not self._quit:
                self._drain_events(timeout=0.005 if self.display else 0.05)
                observations = {w.source_name: w.latest for w in self.workers if w.latest is not None}
                self.cursor.update(observations)
                self._publish_tracking(observations)
                self._check_workers()
                if all(w.finished.is_set() for w in self.workers) and self.events.empty():
                    log.info("All sources finished.")
                    break
                if self.display and self._render(observations):
                    self._quit = True
        except KeyboardInterrupt:
            log.info("Interrupted.")
        finally:
            if previous is not None:
                signal.signal(signal.SIGTERM, previous)
            self.shutdown()
        return 0

    def _install_sigterm(self):
        """Stop cleanly (releasing held keys/buttons) when asked to terminate."""
        def handler(signum, frame):
            log.info("Terminated.")
            self._quit = True
        try:
            return signal.signal(signal.SIGTERM, handler)
        except (ValueError, OSError):  # not on the main thread
            return None

    def _drain_events(self, timeout: float) -> None:
        try:
            event = self.events.get(timeout=timeout)
        except queue.Empty:
            return
        while True:
            for fused in self.fusion.process(event):
                self._dispatch(fused)
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                return

    def _dispatch(self, event: GestureEvent) -> None:
        done = self.executor.handle(event)
        if self.log_events:
            log.info("gesture %s%s", event.label(), f"  ->  {'; '.join(done)}" if done else "")
        self._note(event.label() + (f" -> {done[0].split(' -> ', 1)[-1]}" if done else ""))
        if self.udp is not None:
            self.udp.send(event.to_dict())

    def _publish_tracking(self, observations: Dict[str, Observation]) -> None:
        if self.udp is None or not self.udp.tracking:
            return
        for name, obs in observations.items():
            if self._sent_frames.get(name) != obs.frame.index:
                self._sent_frames[name] = obs.frame.index
                self.udp.send(obs.to_dict())

    def _check_workers(self) -> None:
        for worker in self.workers:
            if worker.finished.is_set() and worker.source_name not in self._reported_dead:
                self._reported_dead.add(worker.source_name)
                if worker.latest is not None or worker.error:
                    self._note(f"{worker.source_name} stopped" + (f": {worker.error}" if worker.error else ""))
                for event in self.fusion.drop_source(worker.source_name, time.monotonic()):
                    self._dispatch(event)

    # --------------------------------------------------------------- display
    def _render(self, observations: Dict[str, Observation]) -> bool:
        import cv2

        from . import viz

        panels = []
        for worker in self.workers:
            obs = observations.get(worker.source_name)
            if obs is not None:
                panels.append(viz.draw_observation(obs, self.display_height, self.show_depth, self.show_mesh))
            elif worker.error:
                panels.append(viz.placeholder(worker.source_name, "Not available:\n" + worker.error,
                                              self.display_height))
            elif worker.finished.is_set():
                panels.append(viz.placeholder(worker.source_name, "stopped", self.display_height))
            else:
                panels.append(viz.placeholder(worker.source_name, "starting...", self.display_height))
        armed = "ARMED" if self.executor.enabled else "PAUSED"
        cursor = f"ON ({self.cursor.mode}) {self.cursor.status}" if self.cursor.active else "off"
        status = [f"actions {armed}   output: {self.backend.name}   cursor: {cursor}", HELP]
        cv2.imshow(WINDOW, viz.compose(panels, self.recent, status))
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            return True
        if key == ord("p"):
            self.executor.set_enabled(not self.executor.enabled)
            self._note(f"actions {'ARMED' if self.executor.enabled else 'PAUSED'}")
        elif key == ord("k"):
            self.cursor.toggle()
            self._note(f"cursor {'ON' if self.cursor.active else 'off'}")
        elif key == ord("c"):
            self.calibrate_head()
        elif key == ord("d"):
            self.show_depth = not self.show_depth
        elif key == ord("m"):
            self.show_mesh = not self.show_mesh
        try:
            if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
                return True
        except cv2.error:
            return True
        return False

    def shutdown(self) -> None:
        for worker in self.workers:
            worker.stop()
        for worker in self.workers:
            worker.join(timeout=3)
        # dispatch the END events workers emitted while stopping (releases held keys)
        self._drain_events(timeout=0.01)
        self.executor.release_all()
        if self.udp is not None:
            self.udp.close()
        if self.display:
            try:
                import cv2

                cv2.destroyAllWindows()
            except Exception:
                pass


def run(cfg: Dict) -> int:
    return App(cfg).run()


__all__ = ["App", "SourceWorker", "run"]
