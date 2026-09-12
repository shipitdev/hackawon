# HackRadar (working name): hackathon discovery + winning-idea generator for Indian students

## Context

Students struggle to (a) find upcoming hackathons scattered across Devfolio, Unstop, MLH, etc., and (b) come up with project ideas that actually win. The goal is a free, public, open-source web app that aggregates upcoming hackathons, keeps a dataset of past winning projects, and uses an LLM grounded in that data to suggest hackathon-specific winning ideas. This is a greenfield project.

**Decisions**
- Audience: **India-focused**. Sources are Devfolio, Unstop and MLH.
- Idea engine: **LLM grounded in hackathon data and similar past winners**.
- Stack: **Python + React**, everything containerized.
- Hosting: **free-only for now, with a clean path to paid/production later.** No always-on server is deployed in v1.
- The **FastAPI server is written and run locally** (docker-compose) but not deployed yet. Deploying it later is a deploy, not a rewrite.
- LLM: **free-tier, non-Claude**. Gemini Flash free tier by default, Groq free tier as fallback; the provider is a config value.
- Winners data: **Devfolio winners + the GitHub API + community-contributed YAML via PRs**. **Devpost is not scraped** — its ToS §4 bans automated access — so v1 only links out to it.
- Grounding: **category-based matching, not per-hackathon winner history** (see "Grounding" below).
- Storage: **no hosted database.** Data lives as JSON/YAML files in the repo; SQLite is a working copy rebuilt from them (git can't diff a binary, and winner submissions arrive as reviewable PRs).

**Research findings (2026-09-11/12)**
- MLH `mlh.com/seasons/<year>/events` is server-rendered HTML.
- Unstop's robots.txt allows `/hackathons/` and `/api/public/*`.
- Devfolio's robots.txt allows everything and its ToS has no scraping clause.
- Devpost has a JSON listing API, but scraping violates its ToS, so it is excluded.
- GitHub Actions is free and unlimited on public repos. Scheduled workflows are disabled after 60 days of repo inactivity, which the jobs' own daily data commits prevent.

## Grounding: category matching (the core idea)

Trying to find *this specific hackathon's* past winners fails in practice: first editions have none, recurring events change themes and sponsors, and matching event names across years is brittle. So both sides are classified into a shared taxonomy instead, and ideas are grounded in whatever won in matching categories at **any** hackathon. Every hackathon then has usable grounding, and a small winners dataset goes much further.

**The taxonomy** lives in `data/taxonomy.yml` — versioned, human-readable and extendable by PR. Three axes:

- **Domain** — fintech, healthtech, devtools, sustainability, agritech, education, accessibility, civic tech, social impact, gaming, AI/agents, web3, IoT/hardware, AR/VR.
- **Build archetype** — browser extension, chatbot/agent, mobile app, hardware + sensors, data dashboard, dev tool/CLI, ML demo, API/infra, game.
- **Winning pattern** (winners only, and the most valuable axis) — solved a pain the judges feel themselves, showcased a sponsor's tech, live demo that actually works, used a dataset nobody else had, unusual hardware, exceptional polish, clear measurable impact.

Domain and archetype say *what a project is*; the winning pattern says *why it beat the others*, which is the part a student can reuse.

**Classification** is one cheap LLM call per new winner, constrained to pick only from the taxonomy (schema-validated; anything unmatched becomes `other` and is flagged for human review). Results are cached by content hash, so re-runs cost nothing and only new or re-tagged projects are billed. Hackathons are classified the same way at ingest, from their themes, tracks and sponsor list.

**Matching** scores candidate winners against a hackathon by domain overlap, archetype feasibility for its duration and format, and recency, then passes the top exemplars plus that category's dominant winning patterns into the idea prompt. If a category is thin (fewer than ~5 exemplars), matching widens to the parent domain and the UI says the grounding is limited — being honest beats inventing confidence. Where same-event winners *do* exist, they're a bonus signal on top, never the backbone.

**This also becomes a feature, not just plumbing:** a **pattern library** page showing what tends to win per domain and why, browsable without picking a hackathon.

## How it runs (v1: no servers)

All the heavy work is batch work, not request-time work, so a scheduled robot can do it and publish the results:

1. A GitHub Actions cron job scrapes Devfolio, Unstop and MLH.
2. Another job asks the LLM for 5 ideas per hackathon, grounded in similar past winners.
3. Both commit their results as JSON to the repo — the commit also keeps the cron alive past GitHub's 60-day inactivity cutoff.
4. GitHub Pages serves a static React site that reads that JSON. Nothing runs between visits, so nothing can cost money or crash at 2am.

**Personalization without a server:** the site builds a ready-made prompt containing the hackathon's details and the relevant past winners, behind a "Copy prompt" button. Students paste it into ChatGPT or Gemini using their own free account. No secret key is exposed, and it costs nothing. The FastAPI `/personalize` endpoint is written and works locally; publishing it is a phase-2 decision.

| Piece | v1 (free) | Later, when you want it |
|---|---|---|
| Site | GitHub Pages | same, or any static host |
| Data | JSON/YAML in the repo | Postgres — change `DATABASE_URL`, nothing else |
| Scrapers + idea generation | GitHub Actions cron | a CronJob in a cluster |
| API server | local only, via docker-compose | Azure Container Apps free grant, Fly, or k3s |
| Personalize | "Copy prompt" button | the live `/personalize` endpoint |

### Keeping the port cheap
- No cloud-specific SDKs anywhere; all config comes from env vars.
- **DB-agnostic queries only** — retrieval and ranking happen in Python, not in SQL dialect-specific features — so SQLite → Postgres really is one env var through SQLAlchemy.
- Images build in CI and push to **GHCR**; `deploy/k8s/` manifests are verified on a local `k3d` cluster, so any cluster later is a `kubectl apply`. This is also the Kubernetes practice you wanted, at zero cost.

## Architecture

```
ideas/                      (repo root; rename when a name is chosen)
├── backend/                Python 3.12, uv, SQLAlchemy 2, FastAPI, Pydantic
│   └── app/
│       ├── api/            FastAPI routes (run locally in v1, deployable later)
│       ├── db/             SQLAlchemy models; SQLite now, Postgres later
│       ├── store/          load JSON/YAML files -> SQLite; write changes back to files
│       ├── sources/        base.py (Source protocol) + mlh.py, devfolio.py, unstop.py
│       ├── winners/        devfolio_winners.py, github.py, community.py
│       ├── taxonomy/       schema.py, classify.py (LLM labelling, hash-cached), match.py
│       ├── ideas/          llm/ (provider.py, gemini.py, groq.py, fake.py),
│       │                   prompt.py, generate.py
│       └── jobs/           ingest.py, ingest_winners.py, classify.py,
│                           generate_ideas.py, export_site.py
│   └── tests/              pytest; saved HTML/JSON fixtures per source (no network in CI)
├── frontend/               React + Vite + TypeScript + Tailwind; reads static JSON
├── data/                   the durable store, human-readable and diffable
│   ├── taxonomy.yml                      domains, archetypes, winning patterns (versioned)
│   ├── hackathons/<source>/<id>.json
│   ├── winners/<hackathon-slug>.yaml     community + scraped, JSON-Schema validated in CI
│   └── ideas/<hackathon-uid>.json
├── deploy/
│   ├── docker-compose.yml  full local stack incl. the API server
│   └── k8s/                kustomize base + overlays/local (k3d)
└── .github/workflows/      ci.yml, ingest.yml (cron 6h), generate-ideas.yml (cron nightly),
                            pages.yml, source-canary.yml
```

### Units and interfaces
- **Source adapters** (`sources/*.py`): each implements `fetch() -> list[HackathonRecord]` (a Pydantic model), is testable against saved fixtures, and knows nothing about storage. Scrapers send an identifying User-Agent (repo URL), stay at ≤1 req/s and respect robots.txt.
- **Ingest job**: runs every adapter, upserts on `(source, source_id)`, dedupes cross-listed events (normalized title + start date), marks unseen events stale, and records per-source counts. One broken source never stops the others.
- **Winners pipeline**: three loaders — Devfolio winner-badged projects, the GitHub API (repos tagged `hackathon-winner` and similar, which is free and explicitly permitted), and community YAML — all producing `WinningProject` records. To respect authors' copyright, store facts only — title, tagline, tech, prize/track, hackathon, year, links, and a ≤300-char summary — and link out for the full text.
- **Classification** (`taxonomy/classify.py`): one constrained LLM call per new winner assigns domains, archetype and winning patterns from `data/taxonomy.yml`. Cached by content hash, so re-runs are free and only new items cost anything. Anything it can't place becomes `other` and is flagged for review rather than guessed.
- **Idea engine**
  - `LLMProvider` interface: `generate(prompt, schema) -> JSON`, with Gemini, Groq and Fake implementations, selected by env var, falling back to Groq on 429/error.
  - `taxonomy/match.py` scores winners against a hackathon on domain overlap, archetype feasibility for its duration and format, and recency — all in Python, keeping it DB-agnostic. No embeddings in v1.
  - The prompt gets the hackathon profile, the dominant winning patterns for its categories, and the top exemplar winners — so ideas are grounded in *why* things win, not just what existed.
  - Output is Pydantic-validated: 5 ideas per hackathon, each with a title, pitch, why it could win, suggested stack, tracks targeted, the winner IDs that inspired it, and a `grounding` field recording how many exemplars backed it.
- **Why it stays free**: ideas are generated **once per hackathon** by the nightly job and stored. Every visitor reads the same file, so LLM usage scales with hackathons (~200/month), not users. The job is throttled to the free-tier rate limit.

### Data model (same shape in files and SQLite)
- `hackathon` — `source`, `source_id`, `title`, `url`; `starts_at`, `ends_at`, `reg_deadline`; `mode` (online/in-person/hybrid), `city`, `country`; `prize_text`, `themes[]`, `tracks[]`; **`domains[]`** (from the taxonomy); `last_seen_at`, `raw`
- `winning_project` — `source` (devfolio|github|community), `hackathon_name`, `year`, `title`, `tagline`, `summary`, `tech[]`, `prize`, `repo_url`, `demo_url`, `project_url`; **`domains[]`, `archetype`, `winning_patterns[]`, `taxonomy_version`, `label_confidence`**
- `idea` — `hackathon_uid`, idea fields, `inspired_by[]`, `provider`, `model`, `prompt_version`, `created_at`
- `source_run` — `source`, `started_at`, `ok`, `count`, `error` (drives the status page and `/health/sources`)

### API (written now, deployed later)
`GET /hackathons` (filters: mode, city, theme, deadline, source) · `GET /hackathons/{id}` · `GET /hackathons/{id}/ideas` · `POST /hackathons/{id}/ideas/personalize` (rate-limited per IP, global daily cap) · `GET /winners` · `GET /health`, `GET /health/sources`

No user accounts; bookmarks live in localStorage.

### Frontend pages
Hackathon list with filters and a deadline countdown · hackathon detail (info, 5 ideas, the exemplar winners behind them, "Copy prompt" button) · **pattern library** (what wins per domain and why, with exemplars) · winners explorer filterable by domain/archetype/pattern · about/contribute · a small status page fed by `source_run`.

Filtering and search run client-side over a few hundred records, which is fast and needs no server.

### Open-source maintenance
- **Licenses**: MIT for code, CC BY 4.0 for `data/`.
- **Contributor docs**: CONTRIBUTING.md covering how to add a source adapter and how to add winners. Issue templates for "new source", "add winners", "source broken".
- **Scraper breakage alerts**: `source-canary.yml` runs the adapters against the live sites daily and auto-opens an issue when one breaks. Scrapers breaking is this app's main long-term cost.
- **Zero-setup local dev**: `docker compose up` runs everything with the Fake LLM provider, so contributors need no API keys.

## Maintainer's working notes

The maintainer keeps a gitignored `CLAUDE.md` at the repo root as working memory for AI-assisted sessions (current state, decisions, dated source checks, next steps). It is intentionally not committed. This document is the public, contributor-facing design.

## Milestones (each gets its own implementation plan via writing-plans)
0. **Kickoff**: `git init`, `.gitignore` (including `CLAUDE.md`), write the initial `CLAUDE.md`, save this design to `docs/superpowers/specs/2026-09-12-hackradar-design.md`, commit. **Source spike**: confirm Devfolio's hackathon and winners endpoints, Unstop's public API, MLH's HTML, and what the GitHub API yields for hackathon-winner repos; read Unstop's full ToS; save fixtures. Cut any source that doesn't hold up.
1. **Skeleton**: backend and frontend scaffolds, file store + SQLite, docker-compose, CI (ruff, pytest, eslint, vitest).
2. **Hackathons**: three source adapters (TDD against fixtures), ingest job, JSON output, list and detail pages, GitHub Pages deploy.
3. **Winners + taxonomy**: `data/taxonomy.yml` drafted by hand, Devfolio and GitHub winner loaders, community YAML + schema + CI validation, classification job, winners explorer. **Checkpoint: hand-check ~30 classified projects before building anything on top of the labels** — if the labels are wrong, every idea downstream is wrong.
4. **Ideas**: matching, provider interface (Fake/Gemini/Groq), prompt, nightly generation workflow, ideas UI, pattern library page, "Copy prompt" button.
5. **API + portability**: FastAPI over the same store, `/personalize` with limits, k8s manifests verified on local `k3d`. Nothing public yet.
6. **Community**: CONTRIBUTING, templates, source canary, seeded "good first issues" (adding winners and extending the taxonomy are ideal first contributions).

## Verification
- `docker compose up` serves the frontend; then
  - `python -m app.jobs.ingest` writes real hackathon JSON into `data/` and the site lists them;
  - `python -m app.jobs.classify` labels winners, and re-running it makes **zero** LLM calls (proving the hash cache works);
  - `python -m app.jobs.generate_ideas` with `LLM_PROVIDER=fake` puts ideas on the detail page;
  - repeating with a real `GEMINI_API_KEY` yields real, schema-valid ideas.
- **Grounding quality** (the one that decides whether this app is worth using): for 10 real upcoming hackathons, check by hand that the matched exemplar winners are actually relevant and the ideas are specific to that hackathon's tracks rather than generic. A thin-data hackathon must visibly say its grounding is limited instead of bluffing.
- `pytest` passes, covering adapters against fixtures, dedupe, filters, LLM output validation, and rate-limit behavior via the Fake provider. Frontend has vitest tests.
- The public check: the GitHub Pages URL loads with real hackathons, on a phone, with no server running anywhere.
- The cron check: manually trigger `ingest.yml`, confirm it commits changed JSON and the live site updates.
- **Portability check** (milestone 5, not deferred): `k3d cluster create && kubectl apply -k deploy/k8s/overlays/local` brings the API up locally and `/health` responds; running the API against Postgres by changing only `DATABASE_URL` passes the same tests.
