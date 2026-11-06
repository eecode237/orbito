.PHONY: help install dev api web db-up db-down seed test lint build clean

help:
	@echo "ORBITO — common commands"
	@echo ""
	@echo "  make install     Install frontend + backend dependencies"
	@echo "  make dev         Run API and web app together"
	@echo "  make api         Run the FastAPI backend only (port 8000)"
	@echo "  make web         Run the Next.js app only (port 3000)"
	@echo "  make db-up       Start PostgreSQL + Redis + MinIO via Docker"
	@echo "  make db-down     Stop the infrastructure containers"
	@echo "  make seed        Seed a demo workspace"
	@echo "  make test        Run backend tests + frontend typecheck/lint"
	@echo "  make build       Production build of the web app"
	@echo "  make clean       Remove local caches and build artifacts"

install:
	pnpm install
	cd apps/api && python3 -m venv .venv && .venv/bin/pip install -q -U pip && .venv/bin/pip install -q -r requirements.txt
	@echo "ORBITO dependencies installed."

dev:
	./scripts/dev.sh

api:
	cd apps/api && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web:
	pnpm --filter @orbito/web dev

db-up:
	docker compose up -d postgres redis minio

db-down:
	docker compose down

seed:
	cd apps/api && .venv/bin/python -m app.seed

test:
	cd apps/api && .venv/bin/pytest -q
	pnpm --filter @orbito/web typecheck
	pnpm --filter @orbito/web lint

build:
	pnpm --filter @orbito/web build

clean:
	rm -rf apps/web/.next apps/web/node_modules/.cache .data
	find apps/api -type d -name __pycache__ -prune -exec rm -rf {} +
