"""Test defaults: isolated database, and the suite never calls a real model server.

Tests write real chat, task and memory rows through the API. They must never
touch the developer database (`.data/orbito.db`), or test prompts appear as
conversations in the user's history. Each pytest session gets a fresh SQLite
file in a temporary directory, set before the application settings are read.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

os.environ.setdefault("OLLAMA_ENABLED", "false")
os.environ["APP_ENV"] = "test"
_test_dir = Path(tempfile.mkdtemp(prefix="orbito-test-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_dir.as_posix()}/orbito-test.db"
