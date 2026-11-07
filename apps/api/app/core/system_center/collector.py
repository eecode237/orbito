"""Central host telemetry collector for the System Center.

The collector is intentionally the *only* place that reads hardware.  Every
endpoint and every UI poll goes through :func:`collector.snapshot`, which keeps
a short cache so ten open widgets cannot each wake the machine.  Samples are
also appended to one in-memory ring buffer, which powers the history charts.

Reads use ``psutil`` where it is portable and ``/sys``/``/proc`` where Linux
exposes richer data (thermal zones, fans, battery health, GPU identity).  A
metric that the host does not expose is returned as ``None`` and flagged as
unsupported; the UI must never replace it with a plausible-looking number.
"""

from __future__ import annotations

import platform
import re
import shutil
import subprocess
from collections import deque
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import psutil

from app.config import settings

SYS = Path("/sys")
PROC = Path("/proc")

# Raw samples live only in memory. 24 h at 3 s is ~29k small dicts; the API
# process stays lightweight while the UI still gets long time ranges.
RETENTION = timedelta(hours=24)
MAX_SAMPLES = int(RETENTION.total_seconds() / max(1.0, settings.system_sample_seconds)) + 16

RANGE_SECONDS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1_800,
    "1h": 3_600,
    "6h": 21_600,
    "24h": 86_400,
}


def _read(path: Path) -> str | None:
    try:
        return path.read_text().strip()
    except OSError:
        return None


def _read_int(path: Path) -> int | None:
    value = _read(path)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _machine() -> dict[str, Any]:
    vendor = _read(SYS / "devices/virtual/dmi/id/sys_vendor")
    product = _read(SYS / "devices/virtual/dmi/id/product_name")
    version = _read(SYS / "devices/virtual/dmi/id/product_version")
    board = _read(SYS / "devices/virtual/dmi/id/board_name")
    label = " ".join(part for part in [vendor, version or product] if part).strip()
    return {
        "vendor": vendor,
        "model": product,
        "version": version,
        "board": board,
        "label": label or platform.node() or None,
    }


def _cpu_frequency() -> dict[str, Any]:
    try:
        current = psutil.cpu_freq()
    except (AttributeError, OSError):
        current = None
    per_core: list[float | None] = []
    try:
        for item in psutil.cpu_freq(percpu=True):
            per_core.append(round(item.current, 0) if item.current else None)
    except (AttributeError, OSError):
        per_core = []
    return {
        "current_mhz": round(current.current, 0) if current and current.current else None,
        "min_mhz": round(current.min, 0) if current and current.min else None,
        "max_mhz": round(current.max, 0) if current and current.max else None,
        "per_core_mhz": per_core,
    }


def _cpu() -> dict[str, Any]:
    try:
        times = psutil.cpu_times_percent(interval=0.12, percpu=False)
    except (AttributeError, OSError):
        times = None
    try:
        per_core = [
            round(max(0.0, min(100.0, value)), 1)
            for value in psutil.cpu_percent(interval=None, percpu=True)
        ]
    except (AttributeError, OSError):
        per_core = []

    def pct(item: Any, field: str) -> float:
        return float(getattr(item, field, 0.0) or 0.0)

    totals = {
        "user": round(pct(times, "user"), 1),
        "system": round(pct(times, "system"), 1),
        "idle": round(pct(times, "idle"), 1),
        "iowait": round(pct(times, "iowait"), 1),
        "nice": round(pct(times, "nice"), 1),
        "irq": round(pct(times, "irq") + pct(times, "softirq"), 1),
        "steal": round(pct(times, "steal"), 1),
    }
    percent = round(max(0.0, min(100.0, 100.0 - totals["idle"])), 1)
    try:
        stats = psutil.cpu_stats()
        context = {
            "ctx_switches": stats.ctx_switches,
            "interrupts": stats.interrupts,
            "soft_interrupts": stats.soft_interrupts,
        }
    except (AttributeError, OSError):
        context = {}

    frequency = _cpu_frequency()
    return {
        "percent": percent,
        "per_core": per_core,
        "cores": psutil.cpu_count(logical=False) or len(per_core) or 1,
        "threads": psutil.cpu_count(logical=True) or len(per_core) or 1,
        "model": _cpu_model(),
        "architecture": platform.machine() or None,
        "frequency": frequency,
        "times": totals,
        "load": _load(),
        "context": context,
    }


def _cpu_model() -> str | None:
    try:
        for line in (PROC / "cpuinfo").read_text().splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or None


def _load() -> dict[str, float] | None:
    try:
        one, five, fifteen = psutil.getloadavg()
    except (AttributeError, OSError):
        return None
    return {"one": round(one, 2), "five": round(five, 2), "fifteen": round(fifteen, 2)}


def _memory() -> dict[str, Any]:
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()
    used = int(memory.total - memory.available)
    reclaimable = int(getattr(memory, "cached", 0) + getattr(memory, "buffers", 0))
    return {
        "total_bytes": int(memory.total),
        "available_bytes": int(memory.available),
        "used_bytes": used,
        "free_bytes": int(memory.free),
        "percent": round(used / memory.total * 100, 1) if memory.total else 0.0,
        "cached_bytes": int(getattr(memory, "cached", 0)),
        "buffers_bytes": int(getattr(memory, "buffers", 0)),
        "shared_bytes": int(getattr(memory, "shared", 0)),
        "active_bytes": int(getattr(memory, "active", 0)),
        "inactive_bytes": int(getattr(memory, "inactive", 0)),
        "reclaimable_bytes": reclaimable,
        "swap": {
            "total_bytes": int(swap.total),
            "used_bytes": int(swap.used),
            "free_bytes": int(swap.free),
            "percent": round(swap.used / swap.total * 100, 1) if swap.total else 0.0,
            "sin_bytes": int(getattr(swap, "sin", 0)),
            "sout_bytes": int(getattr(swap, "sout", 0)),
        },
        # The collector deliberately does not split applications/system RAM:
        # shared pages are counted once per process, so a per-process sum would
        # invent a number. Used + reclaimable cache is the honest split.
        "swap_percent": round(swap.used / swap.total * 100, 1) if swap.total else 0.0,
    }


def _disk_usage(mountpoint: str) -> dict[str, Any] | None:
    try:
        usage = psutil.disk_usage(mountpoint)
    except (OSError, PermissionError):
        return None
    return {
        "total_bytes": int(usage.total),
        "used_bytes": int(usage.used),
        "free_bytes": int(usage.free),
        "percent": round(usage.used / usage.total * 100, 1) if usage.total else 0.0,
    }


def _disk() -> dict[str, Any]:
    partitions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for part in psutil.disk_partitions(all=False):
        if not part.mountpoint or part.mountpoint in seen:
            continue
        seen.add(part.mountpoint)
        usage = _disk_usage(part.mountpoint)
        if usage is None:
            continue
        partitions.append(
            {
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "options": part.opts,
                "physical": part.device.startswith("/dev/")
                and not part.device.startswith("/dev/loop"),
                **usage,
            }
        )
    partitions.sort(key=lambda item: (item["mountpoint"] != "/", item["mountpoint"]))
    root = next((item for item in partitions if item["mountpoint"] == "/"), None)
    if root is None:
        fallback = _disk_usage("/") or {
            "total_bytes": 0,
            "used_bytes": 0,
            "free_bytes": 0,
            "percent": 0.0,
        }
        root = {
            "device": "—",
            "mountpoint": "/",
            "fstype": "—",
            "options": "",
            **fallback,
        }
    return {
        "path": "/",
        "total_bytes": root["total_bytes"],
        "used_bytes": root["used_bytes"],
        "free_bytes": root["free_bytes"],
        "percent": root["percent"],
        "partitions": partitions,
    }


def _rate(current: int, previous: int, elapsed: float) -> float:
    if elapsed <= 0:
        return 0.0
    return round(max(0, current - previous) / elapsed, 0)


def _gpu_from_lspci() -> list[dict[str, Any]]:
    lspci = shutil.which("lspci")
    if not lspci:
        return []
    try:
        output = subprocess.run(
            [lspci, "-nn"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    devices: list[dict[str, Any]] = []
    for line in output.splitlines():
        if not any(
            marker in line.lower()
            for marker in ("vga compatible", "3d controller", "display controller")
        ):
            continue
        ids = re.findall(r"\[([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\]", line)
        name = line.split("]: ", 1)[-1]
        name = re.sub(r"\s*\[[0-9a-fA-F]{4}:[0-9a-fA-F]{4}\].*$", "", name).strip()
        devices.append(
            {
                "vendor_id": ids[-1][0].lower() if ids else None,
                "device_id": ids[-1][1].lower() if ids else None,
                "name": name or "Unknown GPU",
            }
        )
    return devices


def _gpu() -> dict[str, Any]:
    devices: list[dict[str, Any]] = []
    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            output = subprocess.run(
                [
                    nvidia_smi,
                    "--query-gpu=name,driver_version,utilization.gpu,memory.used,"
                    "memory.total,temperature.gpu,clocks.current.graphics",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            ).stdout
        except (OSError, subprocess.SubprocessError):
            output = ""
        for line in output.splitlines():
            parts = [part.strip() for part in line.split(",")]
            if len(parts) < 3:
                continue
            try:
                utilization = float(parts[2])
            except ValueError:
                utilization = None
            devices.append(
                {
                    "vendor": "nvidia",
                    "name": parts[0],
                    "driver": parts[1] or None,
                    "utilization_percent": utilization,
                    "memory_used_bytes": int(float(parts[3]) * 1024**2)
                    if len(parts) > 3 and parts[3]
                    else None,
                    "memory_total_bytes": int(float(parts[4]) * 1024**2)
                    if len(parts) > 4 and parts[4]
                    else None,
                    "temperature_c": float(parts[5]) if len(parts) > 5 and parts[5] else None,
                    "frequency_mhz": float(parts[6]) if len(parts) > 6 and parts[6] else None,
                    "supported_metrics": [
                        "utilization",
                        "memory",
                        "temperature",
                        "frequency",
                    ],
                    "unavailable_metrics": [],
                }
            )

    known = _gpu_from_lspci()
    if not devices:
        for card in sorted(SYS.glob("class/drm/card[0-9]*")):
            device = card / "device"
            vendor_id = _read(device / "vendor")
            device_id = _read(device / "device")
            if not vendor_id or not device_id:
                continue
            vendor_id = vendor_id.removeprefix("0x").lower()
            device_id = device_id.removeprefix("0x").lower()
            match = next(
                (
                    item
                    for item in known
                    if item["vendor_id"] == vendor_id and item["device_id"] == device_id
                ),
                None,
            )
            driver = None
            try:
                driver = (device / "driver").resolve().name
            except OSError:
                pass
            names = {"8086": "Intel", "1002": "AMD", "10de": "NVIDIA"}
            devices.append(
                {
                    "vendor": names.get(vendor_id, vendor_id),
                    "name": (match or {}).get("name") or f"{names.get(vendor_id, 'GPU')} graphics",
                    "driver": driver,
                    "utilization_percent": None,
                    "memory_used_bytes": None,
                    "memory_total_bytes": None,
                    "temperature_c": None,
                    "frequency_mhz": None,
                    "supported_metrics": ["identity", "driver"],
                    "unavailable_metrics": [
                        "utilization",
                        "memory",
                        "temperature",
                        "frequency",
                    ],
                }
            )

    return {
        "devices": devices,
        "available": bool(devices),
        "live_metrics": any(item.get("utilization_percent") is not None for item in devices),
    }


def _thermal() -> dict[str, Any]:
    sensors: list[dict[str, Any]] = []
    for hwmon in sorted(SYS.glob("class/hwmon/hwmon*")):
        source = _read(hwmon / "name") or hwmon.name
        for path in sorted(hwmon.glob("temp*_input")):
            value = _read_int(path)
            if value is None:
                continue
            index = re.sub(r"\D", "", path.name.replace("_input", ""))
            label = _read(hwmon / f"temp{index}_label") or source
            critical = _read_int(hwmon / f"temp{index}_crit")
            sensors.append(
                {
                    "id": f"{hwmon.name}:{path.name}",
                    "source": source,
                    "label": label,
                    "temperature_c": round(value / 1000 if value > 1000 else float(value), 1),
                    "critical_c": round(critical / 1000, 1)
                    if critical and critical > 1000
                    else critical,
                }
            )

    fans: list[dict[str, Any]] = []
    for hwmon in sorted(SYS.glob("class/hwmon/hwmon*")):
        source = _read(hwmon / "name") or hwmon.name
        for path in sorted(hwmon.glob("fan*_input")):
            value = _read_int(path)
            if value is None:
                continue
            index = re.sub(r"\D", "", path.name.replace("_input", ""))
            fans.append(
                {
                    "id": f"{hwmon.name}:{path.name}",
                    "source": source,
                    "label": _read(hwmon / f"fan{index}_label") or source,
                    "rpm": value,
                }
            )

    # CPU-oriented sensors first. A NVMe sensor can be the hottest reading but
    # it is not a CPU temperature, so it must not become the headline value.
    cpu_sensors = [
        item
        for item in sensors
        if item["source"] in {"coretemp", "k10temp", "zenpower", "thinkpad", "acpitz"}
    ]
    package = next(
        (item for item in cpu_sensors if "package" in item["label"].lower()),
        cpu_sensors[0] if cpu_sensors else None,
    )
    max_c = max((item["temperature_c"] for item in sensors), default=None)
    return {
        "sensors": sorted(sensors, key=lambda item: item["temperature_c"], reverse=True),
        "fans": fans,
        "cpu_c": package["temperature_c"] if package else None,
        "max_c": max_c,
        "status": _thermal_status(package["temperature_c"] if package else max_c),
    }


def _thermal_status(value: float | None) -> str:
    if value is None:
        return "unavailable"
    if value >= settings.alert_temperature_critical_c:
        return "critical"
    if value >= settings.alert_temperature_c:
        return "warning"
    return "normal"


def _battery() -> dict[str, Any] | None:
    for base in sorted(SYS.glob("class/power_supply/BAT*")):
        capacity = _read_int(base / "capacity")
        if capacity is None:
            continue
        status = _read(base / "status") or "Unknown"
        energy_now = _read_int(base / "energy_now")
        energy_full = _read_int(base / "energy_full")
        energy_design = _read_int(base / "energy_full_design")
        power_now = _read_int(base / "power_now")
        voltage = _read_int(base / "voltage_now")
        cycle_count = _read_int(base / "cycle_count")
        remaining = None
        if power_now and power_now > 0 and energy_now:
            remaining = int(energy_now / power_now * 3600)
        health = None
        if energy_full and energy_design:
            health = round(energy_full / energy_design * 100, 1)
        return {
            "name": base.name,
            "percent": capacity,
            "status": status,
            "plugged": status.lower() in {"charging", "full", "not charging"},
            "power_w": round(power_now / 1_000_000, 2) if power_now else None,
            "voltage_v": round(voltage / 1_000_000, 2) if voltage else None,
            "energy_wh": round(energy_now / 1_000_000, 2) if energy_now else None,
            "capacity_wh": round(energy_full / 1_000_000, 2) if energy_full else None,
            "design_wh": round(energy_design / 1_000_000, 2) if energy_design else None,
            "health_percent": health,
            "cycle_count": cycle_count,
            "time_remaining_seconds": remaining,
        }
    battery = psutil.sensors_battery()
    if battery is None:
        return None
    return {
        "name": "battery",
        "percent": round(battery.percent, 1),
        "status": "Charging" if battery.power_plugged else "Discharging",
        "plugged": bool(battery.power_plugged),
        "power_w": None,
        "voltage_v": None,
        "energy_wh": None,
        "capacity_wh": None,
        "design_wh": None,
        "health_percent": None,
        "cycle_count": None,
        "time_remaining_seconds": battery.secsleft
        if battery.secsleft and battery.secsleft > 0
        else None,
    }


def _network() -> dict[str, Any]:
    counters = psutil.net_io_counters()
    interfaces = []
    for name, item in psutil.net_io_counters(pernic=True).items():
        interfaces.append(
            {
                "name": name,
                "bytes_sent": item.bytes_sent,
                "bytes_recv": item.bytes_recv,
                "packets_sent": item.packets_sent,
                "packets_recv": item.packets_recv,
                "errors_in": item.errin,
                "errors_out": item.errout,
                "drops_in": item.dropin,
                "drops_out": item.dropout,
            }
        )
    return {
        "bytes_sent": counters.bytes_sent,
        "bytes_recv": counters.bytes_recv,
        "interfaces": sorted(interfaces, key=lambda item: item["bytes_recv"], reverse=True),
    }


def _sample_blocking(collector: "SystemCollector") -> dict[str, Any]:
    """Runs in a worker thread; psutil's interval sampling blocks."""

    import time

    started = time.monotonic()
    elapsed = started - (collector._previous_at or started)

    cpu = _cpu()
    memory = _memory()
    disk = _disk()
    current_disk_io = psutil.disk_io_counters()
    disk_io = {
        "read_bytes": int(current_disk_io.read_bytes) if current_disk_io else 0,
        "write_bytes": int(current_disk_io.write_bytes) if current_disk_io else 0,
        "read_bytes_per_sec": _rate(
            current_disk_io.read_bytes if current_disk_io else 0,
            collector._previous_disk_io.read_bytes if collector._previous_disk_io else 0,
            elapsed,
        )
        if collector._previous_disk_io
        else None,
        "write_bytes_per_sec": _rate(
            current_disk_io.write_bytes if current_disk_io else 0,
            collector._previous_disk_io.write_bytes if collector._previous_disk_io else 0,
            elapsed,
        )
        if collector._previous_disk_io
        else None,
        "read_iops": _rate(
            current_disk_io.read_count if current_disk_io else 0,
            collector._previous_disk_io.read_count if collector._previous_disk_io else 0,
            elapsed,
        )
        if collector._previous_disk_io
        else None,
        "write_iops": _rate(
            current_disk_io.write_count if current_disk_io else 0,
            collector._previous_disk_io.write_count if collector._previous_disk_io else 0,
            elapsed,
        )
        if collector._previous_disk_io
        else None,
    }
    network = _network()
    current_net = psutil.net_io_counters()
    network["recv_per_sec"] = (
        _rate(
            current_net.bytes_recv,
            collector._previous_net_io.bytes_recv,
            elapsed,
        )
        if collector._previous_net_io
        else None
    )
    network["sent_per_sec"] = (
        _rate(
            current_net.bytes_sent,
            collector._previous_net_io.bytes_sent,
            elapsed,
        )
        if collector._previous_net_io
        else None
    )
    thermal = _thermal()
    battery = _battery()
    gpu = _gpu()

    collector._previous_at = started
    collector._previous_disk_io = current_disk_io
    collector._previous_net_io = current_net

    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "generated_at": datetime.now(UTC).isoformat(),
        "uptime_seconds": int(datetime.now().timestamp() - psutil.boot_time()),
        "platform": f"{platform.system()} {platform.release()}",
        "machine": _machine(),
        "cpu": cpu,
        "memory": memory,
        "disk": disk,
        "disk_io": disk_io,
        "network": network,
        "gpu": gpu,
        "thermal": thermal,
        "temperature_c": thermal["cpu_c"] or thermal["max_c"],
        "battery": battery,
        "process_count": len(psutil.pids()),
        "sampling_ms": round((time.monotonic() - started) * 1000),
    }


class SystemCollector:
    def __init__(self, *, cache_seconds: float | None = None) -> None:
        self.cache_seconds = (
            cache_seconds
            if cache_seconds is not None
            else max(1.0, float(settings.system_sample_seconds) - 1.0)
        )
        self._history: deque[dict[str, Any]] = deque(maxlen=MAX_SAMPLES)
        self._cached: dict[str, Any] | None = None
        self._cached_at = 0.0
        self._previous_at: float | None = None
        self._previous_disk_io: Any | None = None
        self._previous_net_io: Any | None = None
        self._lock = None
        try:
            # Seed psutil's per-processor delta so the first sample is useful
            # instead of a zero row.
            psutil.cpu_percent(interval=None, percpu=True)
        except (AttributeError, OSError):
            pass

    @property
    def lock(self):
        if self._lock is None:
            import asyncio

            self._lock = asyncio.Lock()
        return self._lock

    async def snapshot(self, *, force: bool = False) -> dict[str, Any]:
        import asyncio
        import time

        async with self.lock:
            now = time.monotonic()
            if (
                not force
                and self._cached is not None
                and now - self._cached_at < self.cache_seconds
            ):
                return self._cached

            data = await asyncio.to_thread(_sample_blocking, self)
            self._cached = data
            self._cached_at = now
            self._history.append(self._history_point(data))
            return data

    @staticmethod
    def _history_point(data: dict[str, Any]) -> dict[str, Any]:
        gpu = data["gpu"]["devices"][0] if data["gpu"]["devices"] else {}
        return {
            "timestamp": data["timestamp"],
            "cpu_percent": data["cpu"]["percent"],
            "memory_percent": data["memory"]["percent"],
            "swap_percent": data["memory"]["swap"]["percent"],
            "disk_percent": data["disk"]["percent"],
            "temperature_c": data["temperature_c"],
            "battery_percent": data["battery"]["percent"] if data["battery"] else None,
            "read_bytes_per_sec": data["disk_io"]["read_bytes_per_sec"],
            "write_bytes_per_sec": data["disk_io"]["write_bytes_per_sec"],
            "recv_bytes_per_sec": data["network"]["recv_per_sec"],
            "sent_bytes_per_sec": data["network"]["sent_per_sec"],
            "gpu_percent": gpu.get("utilization_percent"),
        }

    async def history(self, range_id: str = "15m", max_points: int = 240) -> dict[str, Any]:
        seconds = RANGE_SECONDS.get(range_id, RANGE_SECONDS["15m"])
        await self.snapshot()
        cutoff = datetime.now(UTC) - timedelta(seconds=seconds)
        points = [
            point
            for point in self._history
            if datetime.fromisoformat(point["timestamp"]) >= cutoff
        ]
        if len(points) > max_points:
            step = len(points) / max_points
            sampled = [points[min(int(index * step), len(points) - 1)] for index in range(max_points)]
            if sampled[-1] is not points[-1]:
                sampled[-1] = points[-1]
            points = sampled
        return {
            "range": range_id if range_id in RANGE_SECONDS else "15m",
            "seconds": seconds,
            "points": points,
            "count": len(points),
            "retention_seconds": int(RETENTION.total_seconds()),
            "generated_at": datetime.now(UTC).isoformat(),
        }

    def reset_for_tests(self) -> None:
        self._history.clear()
        self._cached = None
        self._cached_at = 0.0
        self._previous_at = None
        self._previous_disk_io = None
        self._previous_net_io = None


collector = SystemCollector()
