"""Agents and model catalog."""

from __future__ import annotations

from fastapi import APIRouter

from app.agents.registry import agents
from app.core.model_gateway import gateway
from app.tools.registry import tools

router = APIRouter(tags=["catalog"])


@router.get("/agents")
async def list_agents() -> dict:
    return {
        "agents": agents.describe(),
        "tools": tools.describe(),
    }


@router.get("/models")
async def list_models() -> dict:
    return {
        "models": gateway.describe(),
        "providers": gateway.provider_status(),
        "default_role": gateway.registry.default_role,
    }
