"""Cooperative pause / resume / cancel controls for running tasks.

The orchestrator checks a control between plan steps and while tokens stream.
Pausing is cooperative: it takes effect at the next checkpoint, and a model
response that is already streaming is allowed to finish. This is honest about
what a single-process runtime can do without killing a request mid-token.

Controls are in-memory by design. A task that is not running on this process
cannot be paused, and a restart simply resumes from persisted task state.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field


class TaskCancelled(Exception):
    """Raised at a checkpoint after the user cancels a task."""


@dataclass
class Control:
    task_id: str
    gate: asyncio.Event = field(default_factory=asyncio.Event)
    cancelled: bool = False
    paused: bool = False

    def __post_init__(self) -> None:
        # A new task starts unpaused, so the gate is open.
        self.gate.set()


_controls: dict[str, Control] = {}


def get(task_id: str) -> Control:
    control = _controls.get(task_id)
    if control is None:
        control = Control(task_id=task_id)
        _controls[task_id] = control
    return control


def pause(task_id: str) -> Control:
    control = get(task_id)
    control.paused = True
    control.gate.clear()
    return control


def resume(task_id: str) -> Control:
    control = get(task_id)
    control.paused = False
    control.gate.set()
    return control


def cancel(task_id: str) -> Control:
    control = get(task_id)
    control.cancelled = True
    control.paused = False
    control.gate.set()
    return control


def is_cancelled(task_id: str) -> bool:
    return get(task_id).cancelled


def is_paused(task_id: str) -> bool:
    return get(task_id).paused


def forget(task_id: str) -> None:
    _controls.pop(task_id, None)


async def checkpoint(task_id: str) -> None:
    """Block while paused, then raise if the task was cancelled."""
    control = get(task_id)
    if control.paused:
        await control.gate.wait()
    if control.cancelled:
        raise TaskCancelled("Task cancelled by user")


def active() -> list[str]:
    return [task_id for task_id, control in _controls.items() if not control.cancelled]
