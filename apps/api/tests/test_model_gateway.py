"""Model gateway unit tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import pytest

from app.core.model_gateway import GenerationRequest, Message
from app.core.model_gateway.providers.base import BaseProvider, ProviderError
from app.core.model_gateway.registry import registry
from app.core.model_gateway.router import ModelGateway
from app.core.model_gateway.schemas import ModelSpec, StreamEvent, Usage


class FailingProvider(BaseProvider):
    name = "failing"

    async def stream(self, spec, request) -> AsyncIterator[StreamEvent]:
        raise ProviderError("upstream exploded")
        yield  # pragma: no cover


class EchoProvider(BaseProvider):
    name = "echo"

    async def stream(self, spec, request) -> AsyncIterator[StreamEvent]:
        yield StreamEvent(type="start", provider=self.name, model=spec.model)
        yield StreamEvent(type="delta", text="hello ")
        yield StreamEvent(type="delta", text="world")
        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            usage=Usage(prompt_tokens=3, completion_tokens=2, total_tokens=5),
        )


def test_registry_chain_ends_with_mock():
    chain = registry.chain("fast")
    assert chain, "fast chain must not be empty"
    assert chain[-1].provider == "mock"
    assert any(spec.provider == "mock" for spec in chain)


def test_gateway_falls_back_on_provider_error():
    class Registry:
        roles = {
            "fast": ModelSpec(
                role="fast", provider="failing", model="x", label="failing"
            )
        }
        default_role = "fast"

        def chain(self, role):
            return [
                ModelSpec(role="fast", provider="failing", model="x", label="failing"),
                ModelSpec(role="fast", provider="echo", model="echo-1", label="echo"),
            ]

        def get(self, role):
            return self.roles["fast"]

    gateway = ModelGateway(
        model_registry=Registry(),  # type: ignore[arg-type]
        providers={"failing": FailingProvider(), "echo": EchoProvider()},
    )

    async def run() -> str:
        result = await gateway.generate(
            GenerationRequest(messages=[Message(role="user", content="hi")])
        )
        return result.text

    assert asyncio.run(run()) == "hello world"


@pytest.mark.asyncio
async def test_mock_provider_streams_and_reports_usage():
    gateway = ModelGateway()
    chunks: list[str] = []
    done = None
    async for event in gateway.stream(
        GenerationRequest(
            capability="fast",
            messages=[Message(role="user", content="Find AI jobs in Canada")],
            metadata={"agent": "career", "tool_context": "- Example role"},
        )
    ):
        if event.type == "delta":
            chunks.append(event.text)
        if event.type == "done":
            done = event

    text = "".join(chunks)
    assert "Career" in text or "career" in text
    assert done is not None
    assert done.usage is not None
    assert done.usage.total_tokens > 0
    assert done.provider in {"mock", "ollama", "google", "openai", "anthropic"}
