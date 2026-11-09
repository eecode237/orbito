"""v1 API composition."""

from fastapi import APIRouter

from app.api.v1 import (
    academy,
    catalog,
    chat,
    conversations,
    dashboard,
    files,
    health,
    intel,
    jobs,
    memory,
    model_hub,
    notifications,
    project_tasks,
    safety,
    scraping,
    system,
    tasks,
    workflows,
    workspaces,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(chat.router)
api_router.include_router(catalog.router)
api_router.include_router(model_hub.router)
api_router.include_router(system.router)
api_router.include_router(workspaces.router)
api_router.include_router(tasks.router)
api_router.include_router(project_tasks.router)
api_router.include_router(workflows.router)
api_router.include_router(safety.router)
api_router.include_router(notifications.router)
api_router.include_router(jobs.router)
api_router.include_router(academy.router)
api_router.include_router(conversations.router)
api_router.include_router(memory.router)
api_router.include_router(scraping.router)
api_router.include_router(files.router)
api_router.include_router(intel.router)
api_router.include_router(dashboard.router)

__all__ = ["api_router"]
