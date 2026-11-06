"""Test defaults: the suite never calls a real local model server."""

from __future__ import annotations

import os

os.environ.setdefault("OLLAMA_ENABLED", "false")
