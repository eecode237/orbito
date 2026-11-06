"""Host telemetry for the live dashboard.

Everything is read from the kernel (`/proc`, `/sys`) with the standard library
so the API can run on a fresh clone without an extra native dependency. The
monitor is read-only and safe to poll: results are cached briefly so several
open tabs do not each wake the machine.

`build_alerts` is a pure function over a stats payload, which keeps the
threshold logic testable without touching the host.
"""

from __future__ import annotations

import asyncio
import os
import platform
import shutil
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import settings

PROC = Path("/proc")
SYS = Path("/sys")


def _read_cpu_times() -> list[tuple[int, int]]:
    """Return (idle, total) jiffies for the aggregate CPU and each core."""
    rows: list[tuple[int, int]] = []
    try:
        lines = (PROC / "stat").read_text().splitlines()
    except OSError:
        return rows

    for line in lines:
        if not line.startswith("cpu"):
            continue
        parts = line.split()
        if parts[0] != "cpu" and not parts[0][3:].isdigit():
            continue
        try:
            values = [int(value) for value in parts[1:]]
        except ValueError:
            continue
        # user nice system idle iowait irq softirq steal guest guest_nice
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        rows.append((idle, sum(values)))
    return rows


def _cpu_percent(before: list[tuple[int, int]], after: list[tuple[int, int]]) -> float:
    if not before or len(before) != len(after):
        return 0.0
    idle = sum(row[0] for row in after) - sum(row[0] for row in before)
    total = sum(row[1] for row in after) - sum(row[1] for row in before)
    if total <= 0:
        return 0.0
    return round(max(0.0, min(100.0, (total - idle) / total * 100)), 1)


def _memory() -> dict[str, int]:
    values: dict[str, int] = {}
    try:
        for line in (PROC / "meminfo").read_text().splitlines():
            key, _, rest = line.partition(":")
            parts = rest.strip().split()
            if parts:
                values[key] = int(parts[0]) * 1024
    except (OSError, ValueError):
        pass
    return values


def _cpu_model() -> str | None:
    try:
        for line in (PROC / "cpuinfo").read_text().splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or None


def _disk(path: str) -> dict[str, Any]:
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return {
            "path": path,
            "total_bytes": 0,
            "used_bytes": 0,
            "free_bytes": 0,
            "percent": 0.0,
        }
    return {
        "path": path,
        "total_bytes": usage.total,
        "used_bytes": usage.used,
        "free_bytes": usage.free,
        "percent": round(usage.used / usage.total * 100, 1) if usage.total else 0.0,
    }


def _temperature_c() -> float | None:
    readings: list[float] = []
    for zone in sorted(SYS.glob("class/thermal/thermal_zone*/temp")):
        try:
            value = int(zone.read_text().strip())
        except (OSError, ValueError):
            continue
        # Most drivers report millidegrees; some older ones report degrees.
        readings.append(value / 1000 if value > 1000 else float(value))
    return round(max(readings), 1) if readings else None


def _battery() -> dict[str, Any] | None:
    for base in sorted(SYS.glob("class/power_supply/BAT*")):
        try:
            capacity = int((base / "capacity").read_text().strip())
        except (OSError, ValueError):
            continue
        status = "Unknown"
        try:
            status = (base / "status").read_text().strip()
        except OSError:
            pass
        return {
            "percent": capacity,
            "status": status,
            "plugged": status.lower() in {"charging", "full", "not charging"},
        }
    return None


def _uptime_seconds() -> int:
    try:
        return int(float((PROC / "uptime").read_text().split()[0]))
    except (OSError, ValueError, IndexError):
        return 0


def _load() -> dict[str, float] | None:
    try:
        one, five, fifteen = os.getloadavg()
    except (OSError, AttributeError):
        return None
    return {"one": round(one, 2), "five": round(five, 2), "fifteen": round(fifteen, 2)}


def _alert(
    key: str,
    level: str,
    title: str,
    detail: str,
    value: str,
    href: str | None = None,
) -> dict[str, Any]:
    return {
        "id": key,
        "level": level,
        "title": title,
        "detail": detail,
        "value": value,
        "href": href,
    }


def build_alerts(stats: dict[str, Any]) -> list[dict[str, Any]]:
    """Translate one stats snapshot into actionable alerts."""
    alerts: list[dict[str, Any]] = []
    memory = stats.get("memory") or {}
    disk = stats.get("disk") or {}
    cpu = stats.get("cpu") or {}
    battery = stats.get("battery")
    temperature = stats.get("temperature_c")
    ollama = stats.get("ollama") or {}

    used = float(memory.get("percent") or 0)
    if used >= settings.alert_memory_critical_percent:
        alerts.append(
            _alert(
                "memory-critical",
                "critical",
                "Memory is nearly exhausted",
                "Close browser tabs or unload a model before starting a new task.",
                f"{used:.0f}% used",
            )
        )
    elif used >= settings.alert_memory_percent:
        alerts.append(
            _alert(
                "memory-high",
                "warning",
                "Memory pressure is high",
                "Large local models may spill to swap and slow down.",
                f"{used:.0f}% used",
            )
        )

    swap = float(memory.get("swap_percent") or 0)
    if swap >= settings.alert_swap_percent:
        alerts.append(
            _alert(
                "swap-high",
                "warning",
                "Swap is in heavy use",
                "Response times will drop sharply once the machine starts swapping.",
                f"{swap:.0f}% used",
            )
        )

    disk_used = float(disk.get("percent") or 0)
    if disk_used >= settings.alert_disk_critical_percent:
        alerts.append(
            _alert(
                "disk-critical",
                "critical",
                "Disk is almost full",
                "Model downloads and task artifacts need free space.",
                f"{disk_used:.0f}% used",
                "/settings?tab=hub",
            )
        )
    elif disk_used >= settings.alert_disk_percent:
        alerts.append(
            _alert(
                "disk-high",
                "warning",
                "Disk space is running low",
                "Remove models you no longer use or clear old task artifacts.",
                f"{disk_used:.0f}% used",
                "/settings?tab=hub",
            )
        )

    cpu_used = float(cpu.get("percent") or 0)
    if cpu_used >= settings.alert_cpu_percent:
        alerts.append(
            _alert(
                "cpu-high",
                "warning",
                "CPU is saturated",
                "Local generation shares the CPU with the rest of the system.",
                f"{cpu_used:.0f}% used",
            )
        )

    if temperature is not None and temperature >= settings.alert_temperature_critical_c:
        alerts.append(
            _alert(
                "temperature-critical",
                "critical",
                "The machine is running hot",
                "Pause heavy workloads and check that the fan vents are clear.",
                f"{temperature:.0f} °C",
            )
        )
    elif temperature is not None and temperature >= settings.alert_temperature_c:
        alerts.append(
            _alert(
                "temperature-high",
                "warning",
                "High CPU temperature",
                "Sustained heat throttles local model speed.",
                f"{temperature:.0f} °C",
            )
        )

    if (
        battery
        and battery.get("percent") is not None
        and not battery.get("plugged")
        and battery["percent"] <= settings.alert_battery_percent
    ):
        alerts.append(
            _alert(
                "battery-low",
                "warning",
                "Battery is low",
                "Plug in before starting a long local generation.",
                f"{battery['percent']}%",
            )
        )

    if settings.ollama_enabled and ollama and not ollama.get("reachable"):
        alerts.append(
            _alert(
                "ollama-offline",
                "warning",
                "Local model server is offline",
                ollama.get("error") or "Start Ollama to use local models.",
                "offline",
                "/settings?tab=hub",
            )
        )

    return alerts


class SystemMonitor:
    """Sampled host stats with a short cache."""

    def __init__(self, *, with_ollama: bool = True, cache_seconds: float = 1.0) -> None:
        self.with_ollama = with_ollama
        self.cache_seconds = cache_seconds
        self._cached: dict[str, Any] | None = None
        self._cached_at = 0.0
        self._lock = asyncio.Lock()

    async def stats(self) -> dict[str, Any]:
        async with self._lock:
            now = time.monotonic()
            if self._cached and now - self._cached_at < self.cache_seconds:
                return self._cached

            stats = await self._sample()
            self._cached = stats
            self._cached_at = now
            return stats

    async def alerts(self) -> dict[str, Any]:
        stats = await self.stats()
        return {
            "alerts": build_alerts(stats),
            "generated_at": stats["timestamp"],
        }

    async def _sample(self) -> dict[str, Any]:
        before = _read_cpu_times()
        await asyncio.sleep(0.12)
        after = _read_cpu_times()

        cores = max(0, len(after) - 1)
        overall = _cpu_percent(before[:1], after[:1])
        per_core = [
            _cpu_percent([before[index]], [after[index]])
            for index in range(1, min(len(before), len(after)))
        ]

        memory = _memory()
        total = int(memory.get("MemTotal", 0))
        available = int(memory.get("MemAvailable", memory.get("MemFree", 0)))
        used = max(0, total - available)
        swap_total = int(memory.get("SwapTotal", 0))
        swap_free = int(memory.get("SwapFree", 0))
        swap_used = max(0, swap_total - swap_free)

        stats: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "platform": f"{platform.system()} {platform.release()}",
            "uptime_seconds": _uptime_seconds(),
            "cpu": {
                "percent": overall,
                "per_core": per_core,
                "cores": cores or os.cpu_count() or 1,
                "model": _cpu_model(),
                "load": _load(),
            },
            "memory": {
                "total_bytes": total,
                "available_bytes": available,
                "used_bytes": used,
                "percent": round(used / total * 100, 1) if total else 0.0,
                "swap_total_bytes": swap_total,
                "swap_used_bytes": swap_used,
                "swap_percent": round(swap_used / swap_total * 100, 1) if swap_total else 0.0,
            },
            "disk": _disk(str(Path.home())),
            "temperature_c": _temperature_c(),
            "battery": _battery(),
        }

        if self.with_ollama and settings.ollama_enabled:
            stats["ollama"] = await self._ollama()
        else:
            stats["ollama"] = {
                "reachable": False,
                "version": None,
                "base_url": settings.ollama_base_url,
                "error": "Local models are disabled.",
            }

        return stats

    @staticmethod
    async def _ollama() -> dict[str, Any]:
        # Imported lazily so tests can run the monitor without the gateway.
        from app.core.model_gateway.hub import ModelHub

        return await ModelHub().status(timeout=1.5)


monitor = SystemMonitor()
