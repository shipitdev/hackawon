# Hackawon

**[shipitdev.github.io/hackawon](https://shipitdev.github.io/hackawon/)**

Upcoming hackathons for students, categorised by topic and sorted by what closes soonest —
each one with project ideas grounded in what has actually won before. Free to use, free to run,
open source.

Built for Indian students, who currently have to check three or four sites to find out what's on.

## How it works

There is no server. Scraping, labelling and idea generation are scheduled work, not request-time
work, so GitHub Actions does all of it and commits the results:

```
on a schedule, on GitHub's runners
  scrape Devfolio + Unstop + MLH        every 6 hours
    → normalise, drop finished events, de-duplicate
    → write data/hackathons/**.json     (the `data` branch is the database)
    → label each one by topic with an LLM, cached so re-runs are free
  collect winning projects from GitHub  weekly
  generate 5 ideas per hackathon        nightly, grounded in matching past winners
    → prerender a static page per hackathon, plus a sitemap
  push to the data branch → deploy → GitHub Pages serves it
```

Nothing runs between visits, so it costs nothing to operate and there is no server to fall over at
2am. A visitor downloads about 48 KB of data and 69 KB of JavaScript.

The data lives in this repo as plain JSON on its own `data` branch, so `main` only carries commits
people made. That still gives full history through git, and a correction can arrive as a pull
request that a human reads before merging.

**The one exception is per-user data.** Sign-in and saved hackathons go to Supabase, because they
are the only things that differ per person. Listings and ideas stay static: they are identical for
every visitor, so putting them in a database would add cost and fragility for nothing.

## What works

| | |
|---|---|
| Hackathons | ~267 from three sources, refreshed every 6 hours |
| Topics | 15 categories, with filters and search |
| Past winners | 675 verified, labelled by domain, shape, and *why* they won |
| Project ideas | 5 per hackathon — 1,300+, each citing the winners that inspired it |
| Pages | One real URL per hackathon, prerendered, readable without JavaScript |
| Saving | Star any hackathon; works signed out, follows you across devices when signed in |
| Sign-in | GitHub |
| Toolkit | Curated free tools and API tiers, each with a "last checked" date |
| Monitoring | A daily canary that files an issue when a scraper breaks **or quietly returns less data** |

## Not yet

A winners explorer · a "what tends to win" pattern library · deadline reminder emails ·
community-submitted hackathons · inferring Unstop's missing country field.

## Running it locally

```bash
make check          # everything CI runs: pytest, ruff, tsc, vitest

# Backend — scraping, labelling, export
cd backend
uv venv && uv pip install -e ".[dev]"
../scripts/data-branch.sh pull           # copy the generated data from the data branch into data/
uv run python -m app.jobs.export_site    # build what the site reads

# Frontend
cd ../frontend
npm install
npm run dev
```

**No API keys or accounts are needed.** Labelling defaults to a fake LLM provider, sign-in hides
itself when unconfigured, and saved hackathons fall back to browser storage. Tests never touch the
network. To use the real services, copy `frontend/.env.example` and set `GEMINI_API_KEY`.

## Layout

| Path | What it is |
|---|---|
| `backend/app/sources/` | One adapter per site. Pure `parse()` + `fetch()`, tested against saved fixtures. |
| `backend/app/winners/` | Finds past winners on GitHub and judges whether a win claim is credible. |
| `backend/app/taxonomy.py` | Labels hackathons and projects against `data/taxonomy.yml`. |
| `backend/app/health.py` | Detects a source that still responds but has stopped returning data. |
| `backend/app/ideas/` | LLM providers, exemplar matching, prompt, generation. |
| `backend/app/jobs/` | The scheduled entry points. |
| `data/` | The database: JSON per hackathon and winner, plus the hand-edited taxonomy and toolkit. |
| `frontend/src/` | Static React site. `data.ts` is the only place app data is fetched. |
| `frontend/scripts/prerender.mjs` | Renders a static page per hackathon at build time. |
| `docs/supabase-setup.sql` | Tables and row-level security for per-user data. |

## Where the data comes from

| Source | What we take | Notes |
|---|---|---|
| [Unstop](https://unstop.com) | Open hackathons | Under `/api/public/*`, which their robots.txt allows. The best source for Indian events. |
| [Devfolio](https://devfolio.co) | Open hackathons, sponsor prizes | robots.txt allows all; terms contain no scraping clause. |
| [MLH](https://mlh.com) | Season events | Parsed from schema.org microdata, which they publish for search engines. |
| [GitHub](https://github.com) | Past winning projects | Official API. |

**Devpost is deliberately excluded.** Its terms of service prohibit automated access, so we link
out to it rather than collect from it — even though it has the largest winners dataset.

Scrapers identify themselves, stay at one request per second, and respect robots.txt. If you run
one of these sites and want something changed, open an issue.

## Contributing

The most useful contributions, roughly in order:

- **Add a tool to the toolkit.** `data/tools.yml` is one file and the list is explicitly
  incomplete. Say what you *actually* get, not "generous free tier", and date it.
- **Fix a broken scraper.** Sites redesign; the canary opens an issue when one breaks. Adapters
  live in `backend/app/sources/` with saved responses in `backend/tests/fixtures/`, so you can
  work entirely offline.
- **Add a source.** Implement `parse()` and `fetch()` returning `HackathonRecord`s.
- **Improve the taxonomy.** `data/taxonomy.yml` is a plain file. Bump `version` if existing labels
  should be recomputed.

`make check` must pass, and tests must run without network access.

### A note on honesty

Several decisions here trade coverage for truthfulness, and changes are expected to keep that
bargain:

- About half the winners have no recorded reason for winning, because most repo descriptions only
  say "1st place". The prompt forbids inventing one.
- "Showcased a sponsor's technology" is kept only when the text says what the project was built
  on. It was being inferred from event names and appeared on most labelled winners, which made it
  meaningless.
- Toolkit entries carry the date a human last checked them and grey out after 90 days. Free tiers
  change constantly — xAI's free credits ended in May 2025 and much of the web still recommends
  them.
- Where grounding is thin, the site says so rather than implying confidence it does not have.

## Licence

Code is MIT. The collected data in `data/` is CC BY 4.0. Hackathon listings and project
descriptions belong to their original authors — we store facts and link back rather than
republishing their content.
