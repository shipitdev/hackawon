# Run exactly what CI runs, so a push cannot fail on something checkable locally.
# CI failed once on `ruff format --check` because only `ruff check` was run by hand.
.PHONY: check backend-check frontend-check build data

check: backend-check frontend-check

backend-check:
	cd backend && .venv/bin/python -m pytest -q
	cd backend && .venv/bin/python -m ruff check .
	cd backend && .venv/bin/python -m ruff format --check .

frontend-check:
	cd frontend && npx tsc -b
	cd frontend && npx vitest run

# Generated data is on the `data` branch; this puts a copy in data/ for local work.
data:
	scripts/data-branch.sh pull

build: data
	cd backend && .venv/bin/python -m app.jobs.export_site
	cd frontend && npm run build
