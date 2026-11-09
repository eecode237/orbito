"""Academy: flashcards the user writes and reviews. Review counts come from real actions."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.schemas import StudyCardCreate
from app.db import repositories as repo

router = APIRouter(prefix="/academy/cards", tags=["academy"])


def _payload(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "deck": row.deck,
        "front": row.front,
        "back": row.back,
        "review_count": row.review_count or 0,
        "last_reviewed_at": row.last_reviewed_at.isoformat() if row.last_reviewed_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("")
async def list_cards(deck: str | None = Query(default=None, max_length=80)) -> dict[str, Any]:
    rows = await repo.list_study_cards(deck=deck)
    decks: dict[str, int] = {}
    for row in rows:
        decks[row.deck] = decks.get(row.deck, 0) + 1
    return {"cards": [_payload(row) for row in rows], "decks": decks, "generated_at": datetime.now(UTC).isoformat()}


@router.post("", status_code=201)
async def create_card(payload: StudyCardCreate) -> dict[str, Any]:
    row = await repo.create_study_card(deck=payload.deck, front=payload.front.strip(), back=payload.back.strip())
    if row is None:
        raise HTTPException(status_code=503, detail="Study store unavailable")
    return {"card": _payload(row)}


@router.post("/{card_id}/review")
async def review_card(card_id: str) -> dict[str, Any]:
    row = await repo.record_card_review(card_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"card": _payload(row)}


@router.delete("/{card_id}", status_code=204)
async def delete_card(card_id: str) -> Response:
    if not await repo.delete_study_card(card_id):
        raise HTTPException(status_code=404, detail="Card not found")
    return Response(status_code=204)

