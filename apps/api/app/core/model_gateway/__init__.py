"""Public surface of the Model Gateway."""

from app.core.model_gateway.registry import registry
from app.core.model_gateway.router import ModelGateway, gateway
from app.core.model_gateway.schemas import (
    GenerationRequest,
    GenerationResult,
    Message,
    ModelSpec,
    StreamEvent,
    Usage,
)

__all__ = [
    "GenerationRequest",
    "GenerationResult",
    "Message",
    "ModelGateway",
    "ModelSpec",
    "StreamEvent",
    "Usage",
    "gateway",
    "registry",
]
