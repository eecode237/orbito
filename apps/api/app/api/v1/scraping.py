"""Scraping Studio API."""

from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.schemas import ScrapingJobCreate
from app.db import repositories as repo
from app.tools.net import UnsafeURLError, validate_public_url
from app.tools.scraping import schedule_job

router = APIRouter(prefix="/scraping", tags=["scraping"])


def _job_payload(job) -> dict:
    return {
        "id": job.id,
        "name": job.name,
        "urls": job.urls,
        "schema": job.schema_,
        "config": job.config,
        "status": job.status,
        "progress": job.progress,
        "pages_done": job.pages_done,
        "pages_total": job.pages_total,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.post("/jobs", status_code=201)
async def create_job(payload: ScrapingJobCreate) -> dict:
    for url in payload.urls:
        try:
            await validate_public_url(url)
        except UnsafeURLError as exc:
            raise HTTPException(status_code=400, detail=f"Unsafe URL {url}: {exc}") from exc

    name = payload.name or "Scrape " + payload.urls[0][:60]
    job_id = await repo.create_scraping_job(
        name=name, urls=payload.urls, schema=payload.scrape_schema, config=payload.config
    )
    if not job_id:
        raise HTTPException(status_code=503, detail="Scraping queue unavailable")
    schedule_job(job_id)
    return {"id": job_id, "status": "queued"}


@router.get("/jobs")
async def list_jobs(limit: int = 20) -> dict:
    jobs = await repo.list_scraping_jobs(limit=min(limit, 100))
    return {"jobs": [_job_payload(job) for job in jobs]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    job = await repo.get_scraping_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scraping job not found")
    results = await repo.list_scraping_results(job_id)
    return {
        "job": _job_payload(job),
        "results": [{"url": item.url, "data": item.data} for item in results],
    }


@router.get("/jobs/{job_id}/export")
async def export_job(job_id: str, format: str = "json"):
    job = await repo.get_scraping_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scraping job not found")
    results = await repo.list_scraping_results(job_id)
    rows = [{"url": item.url, **item.data} for item in results]

    if format == "json":
        return JSONResponse({"job": _job_payload(job), "results": rows})

    if format == "csv":
        fieldnames: list[str] = []
        for row in rows:
            for key in row:
                if key not in fieldnames:
                    fieldnames.append(key)
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=fieldnames or ["url"])
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value) if isinstance(value, (list, dict)) else value
                             for key, value in row.items()})
        buffer.seek(0)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="orbito-{job_id}.csv"'},
        )

    raise HTTPException(status_code=400, detail="format must be json or csv")
