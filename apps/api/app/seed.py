"""Seed a little demo context. Safe to run repeatedly."""

from __future__ import annotations

import asyncio

from app.db import repositories as repo
from app.db.session import engine, init_db


async def main() -> None:
    await init_db()
    await repo.ensure_demo_user()

    memories = [
        ("Prefers concise answers with concrete next steps.", "preference"),
        ("Based in Canada; open to remote roles.", "profile"),
        ("Currently learning machine learning and preparing for exams.", "goal"),
    ]
    for content, key in memories:
        await repo.add_memory(content, key=key)

    print("Seeded ORBITO demo workspace.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
