"""Job application tracker and flashcards: real CRUD against the database."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_application_lifecycle_records_applied_time():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/jobs/applications",
            json={"company": "Acme", "role": "ML Engineer", "match_score": 82.5, "notes": "Found via referral"},
        )
        assert created.status_code == 201, created.text
        app_id = created.json()["application"]["id"]
        assert created.json()["application"]["status"] == "saved"
        assert created.json()["application"]["applied_at"] is None

        moved = client.patch(f"/api/v1/jobs/applications/{app_id}", json={"status": "applied"})
        assert moved.status_code == 200
        assert moved.json()["application"]["applied_at"] is not None

        listed = client.get("/api/v1/jobs/applications").json()
        assert any(item["id"] == app_id for item in listed["applications"])
        assert listed["counts"].get("applied", 0) >= 1

        assert client.delete(f"/api/v1/jobs/applications/{app_id}").status_code == 204
        assert client.patch(f"/api/v1/jobs/applications/{app_id}", json={"status": "offer"}).status_code == 404


def test_application_validation_rejects_unknown_status_and_blank_company():
    with TestClient(app) as client:
        assert client.post(
            "/api/v1/jobs/applications", json={"company": "X", "role": "Y", "status": "hired"}
        ).status_code == 422
        assert client.post(
            "/api/v1/jobs/applications", json={"company": "", "role": "Y"}
        ).status_code == 422


def test_flashcards_count_only_real_reviews():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/academy/cards",
            json={"deck": "ML", "front": "What is gradient descent?", "back": "Iterative minimization along the negative gradient."},
        )
        assert created.status_code == 201, created.text
        card_id = created.json()["card"]["id"]
        assert created.json()["card"]["review_count"] == 0

        reviewed = client.post(f"/api/v1/academy/cards/{card_id}/review")
        assert reviewed.json()["card"]["review_count"] == 1
        assert reviewed.json()["card"]["last_reviewed_at"] is not None

        listed = client.get("/api/v1/academy/cards?deck=ML").json()
        assert listed["decks"].get("ML", 0) >= 1
        assert any(card["id"] == card_id for card in listed["cards"])

        assert client.delete(f"/api/v1/academy/cards/{card_id}").status_code == 204
        assert client.post(f"/api/v1/academy/cards/{card_id}/review").status_code == 404

