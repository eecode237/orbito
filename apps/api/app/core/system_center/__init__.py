"""System Center: one collector, process manager, history and alerts."""

from app.core.system_center import alerts, processes
from app.core.system_center.collector import collector

__all__ = ["alerts", "collector", "processes"]
