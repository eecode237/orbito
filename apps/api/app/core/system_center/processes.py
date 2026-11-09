"""Process inspection and guarded termination for the System Center.

Everything comes from ``psutil`` and is read as the API's own OS user.  When the
kernel refuses a read (for example another user's open files) the field is
returned as ``None`` with a note; it is never guessed.  Termination is limited
to ordinary processes and refuses PID 1, the API itself, its parent, kernel
threads and a short list of critical session daemons.
"""

from __future__ import annotations

import os
import time
from collections import deque
from datetime import UTC, datetime
from typing import Any

import psutil

PROTECTED_NAMES = {
    "systemd",
    "init",
    "kthreadd",
    "dbus-daemon",
    "dbus-broker",
    "sshd",
    "xorg",
    "gnome-shell",
    "dockerd",
    "containerd",
    "auditd",
    "polkitd",
}
KERNEL_PREFIXES = ("kworker", "ksoftirqd", "migration", "rcu", "watchdog", "cpuhp")
SECRET_MARKERS = (
    "password",
    "passwd",
    "token",
    "secret",
    "api-key",
    "apikey",
    "authorization",
    "cookie",
    "credential",
)

PROCESS_HISTORY: dict[int, deque[dict[str, Any]]] = {}
MAX_PROCESS_SAMPLES = 60


class ProcessNotFound(Exception):
    pass


class ProcessPermissionDenied(Exception):
    pass


class ProcessStillRunning(Exception):
    pass


def _iso(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=UTC).isoformat()


def _safe(callable_, default=None):
    try:
        return callable_()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, OSError):
        return default


def _open_fds(proc: psutil.Process) -> int | None:
    """Open file descriptors are POSIX-only; Windows reports them as unavailable."""
    reader = getattr(proc, "num_fds", None)
    return _safe(reader, None) if reader else None


def _is_protected(proc: psutil.Process) -> bool:
    if proc.pid <= 1:
        return True
    if proc.pid in {os.getpid(), os.getppid()}:
        return True
    name = (_safe(proc.name, "") or "").lower()
    if name in PROTECTED_NAMES:
        return True
    if any(name.startswith(prefix) for prefix in KERNEL_PREFIXES):
        return True
    username = _safe(proc.username, None)
    if username == "root" and os.geteuid() != 0:
        return True
    return False


def _redact(args: list[str]) -> list[str]:
    """Redact values that look like credentials without hiding the flag name."""
    redacted: list[str] = []
    hide_next = False
    for arg in args:
        if hide_next:
            redacted.append("***")
            hide_next = False
            continue
        lowered = arg.lower()
        if "=" in arg:
            key = lowered.split("=", 1)[0]
            if any(marker in key for marker in SECRET_MARKERS):
                redacted.append(f"{arg.split('=', 1)[0]}=***")
                continue
        if any(marker in lowered for marker in SECRET_MARKERS):
            redacted.append(arg)
            hide_next = True
            continue
        redacted.append(arg)
    return redacted


def _record(pid: int, cpu: float, memory_bytes: int) -> None:
    history = PROCESS_HISTORY.setdefault(pid, deque(maxlen=MAX_PROCESS_SAMPLES))
    history.append(
        {
            "timestamp": datetime.now(UTC).isoformat(),
            "cpu_percent": cpu,
            "memory_bytes": memory_bytes,
        }
    )


def _base_rows(
    *,
    query: str | None = None,
    user: str | None = None,
    min_cpu: float | None = None,
    min_memory: float | None = None,
) -> list[dict[str, Any]]:
    needle = query.strip().lower() if query else None
    rows: list[dict[str, Any]] = []
    for proc in psutil.process_iter():
        try:
            pid = proc.pid
            name = proc.name()
            username = _safe(proc.username, None)
            if needle and not (
                needle in name.lower()
                or needle in (username or "").lower()
                or str(pid) == needle
            ):
                continue
            if user and username != user:
                continue
            cpu = round(proc.cpu_percent(interval=None), 1)
            memory_info = _safe(proc.memory_info, None)
            memory_bytes = int(memory_info.rss) if memory_info else 0
            memory_percent = round(_safe(proc.memory_percent, 0.0) or 0.0, 2)
            if min_cpu is not None and cpu < min_cpu:
                continue
            if min_memory is not None and memory_percent < min_memory:
                continue
            create_time = _safe(proc.create_time, None)
            status = _safe(proc.status, "unknown")
            threads = _safe(proc.num_threads, None)
            ppid = _safe(proc.ppid, None)
            _record(pid, cpu, memory_bytes)
            rows.append(
                {
                    "pid": pid,
                    "ppid": ppid,
                    "name": name,
                    "username": username,
                    "cpu_percent": cpu,
                    "memory_bytes": memory_bytes,
                    "memory_percent": memory_percent,
                    "status": status,
                    "created_at": _iso(create_time),
                    "runtime_seconds": int(time.time() - create_time) if create_time else None,
                    "threads": threads,
                    "protected": _is_protected(proc),
                    "can_terminate": not _is_protected(proc),
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    return rows


def list_processes(
    *,
    query: str | None = None,
    user: str | None = None,
    sort: str = "cpu",
    limit: int = 50,
    offset: int = 0,
    min_cpu: float | None = None,
    min_memory: float | None = None,
) -> dict[str, Any]:
    rows = _base_rows(
        query=query,
        user=user,
        min_cpu=min_cpu,
        min_memory=min_memory,
    )
    key = {
        "cpu": ("cpu_percent", True),
        "memory": ("memory_bytes", True),
        "memory_percent": ("memory_percent", True),
        "name": ("name", False),
        "pid": ("pid", False),
        "runtime": ("runtime_seconds", True),
    }.get(sort, ("cpu_percent", True))
    rows.sort(key=lambda item: item[key[0]] or 0, reverse=key[1])
    start = max(0, offset)
    window = rows[start : start + max(1, min(200, limit))]
    return {
        "processes": window,
        "total": len(rows),
        "limit": max(1, min(200, limit)),
        "offset": start,
        "generated_at": datetime.now(UTC).isoformat(),
    }


def process_detail(pid: int) -> dict[str, Any]:
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess as exc:
        raise ProcessNotFound(f"Process {pid} does not exist") from exc

    try:
        name = proc.name()
    except psutil.AccessDenied as exc:
        raise ProcessPermissionDenied(str(exc)) from exc

    cpu = round(proc.cpu_percent(interval=None), 1)
    memory = _safe(proc.memory_info, None)
    cpu_times = _safe(proc.cpu_times, None)
    io = _safe(proc.io_counters, None)
    create_time = _safe(proc.create_time, None)
    connections = _safe(lambda: proc.net_connections(kind="inet"), None)
    open_files = _safe(proc.open_files, None)
    cmdline = _safe(proc.cmdline, []) or []
    _record(pid, cpu, int(memory.rss) if memory else 0)

    return {
        "pid": pid,
        "ppid": _safe(proc.ppid, None),
        "name": name,
        "username": _safe(proc.username, None),
        "status": _safe(proc.status, "unknown"),
        "exe": _safe(proc.exe, None),
        "cwd": _safe(proc.cwd, None),
        "cmdline": _redact(cmdline),
        "created_at": _iso(create_time),
        "runtime_seconds": int(time.time() - create_time) if create_time else None,
        "cpu_percent": cpu,
        "cpu_times": {
            "user_seconds": round(getattr(cpu_times, "user", 0.0), 2),
            "system_seconds": round(getattr(cpu_times, "system", 0.0), 2),
        }
        if cpu_times
        else None,
        "memory_bytes": int(memory.rss) if memory else None,
        "memory_vms_bytes": int(memory.vms) if memory else None,
        "memory_percent": round(_safe(proc.memory_percent, 0.0) or 0.0, 2),
        "threads": _safe(proc.num_threads, None),
        "fds": _open_fds(proc),
        "nice": _safe(proc.nice, None),
        "io": {
            "read_bytes": int(io.read_bytes),
            "write_bytes": int(io.write_bytes),
            "read_count": int(io.read_count),
            "write_count": int(io.write_count),
        }
        if io
        else None,
        "connections": [
            {
                "fd": item.fd,
                "status": item.status,
                "family": str(item.family),
                "type": str(item.type),
                "laddr": f"{item.laddr.ip}:{item.laddr.port}" if item.laddr else None,
                "raddr": f"{item.raddr.ip}:{item.raddr.port}" if item.raddr else None,
            }
            for item in (connections or [])
        ][:20],
        "open_files": [
            {"path": item.path, "fd": item.fd} for item in (open_files or [])
        ][:30],
        "history": list(PROCESS_HISTORY.get(pid, [])),
        "protected": _is_protected(proc),
        "can_terminate": not _is_protected(proc),
        "notes": [
            note
            for note, value in [
                ("Open files are not readable for this user.", open_files),
                ("Network connections are not readable for this user.", connections),
                ("I/O counters are not exposed by the kernel.", io),
            ]
            if value is None
        ],
    }


def terminate_process(pid: int, *, force: bool = False) -> dict[str, Any]:
    if pid <= 1:
        raise ProcessPermissionDenied("PID 1 is protected")
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess as exc:
        raise ProcessNotFound(f"Process {pid} does not exist") from exc
    if _is_protected(proc):
        raise ProcessPermissionDenied(f"Process {pid} is protected")
    try:
        proc.terminate()
    except psutil.AccessDenied as exc:
        raise ProcessPermissionDenied(str(exc)) from exc

    try:
        proc.wait(timeout=3)
    except psutil.TimeoutExpired:
        if not force:
            raise ProcessStillRunning(
                f"Process {pid} ignored SIGTERM; retry with force=true to send SIGKILL"
            ) from None
        try:
            proc.kill()
            proc.wait(timeout=3)
        except psutil.AccessDenied as exc:
            raise ProcessPermissionDenied(str(exc)) from exc
        except psutil.TimeoutExpired as exc:
            raise ProcessStillRunning(f"Process {pid} is still running after SIGKILL") from exc

    return {
        "pid": pid,
        "terminated": not psutil.pid_exists(pid),
        "signal": "SIGKILL" if force else "SIGTERM",
    }
