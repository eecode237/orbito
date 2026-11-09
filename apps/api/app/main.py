"""ORBITO API entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import settings
from app.db.repositories import ensure_demo_user
from app.db.session import engine, init_db
from app.logging import get_logger, setup_logging

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    await init_db()
    await ensure_demo_user()
    logger.info("%s v%s ready (%s)", settings.app_name, settings.app_version, settings.app_env)
    yield
    await engine.dispose()


app = FastAPI(
    title="ORBITO API",
    description="One agent. Infinite possibilities. Model gateway, agents, tools, tasks.",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": f"http_{exc.status_code}", "message": exc.detail}},
    )


def _json_safe(value):
    if isinstance(value, BaseException):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = _json_safe(exc.errors())
    first = errors[0] if errors else {}
    message = first.get("msg", "Invalid request") if isinstance(first, dict) else "Invalid request"
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": message, "detail": errors}},
    )


@app.get("/", include_in_schema=False)
async def index() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "tagline": "One Agent. Infinite Possibilities.",
        "docs": "/docs",
        "api": settings.api_prefix,
    }
