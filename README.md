# HackRadar

**[shipitdev.github.io/hackawon](https://shipitdev.github.io/hackawon/)**

Upcoming hackathons for students — gathered from Devfolio, Unstop and MLH, categorised by topic,
and sorted by what closes soonest. Free to use, free to run, open source.

Built for Indian students, who currently have to check three or four sites to find out what's on.

## How it works

There is no server. Scraping is scheduled work, not request-time work, so a GitHub Action does it
and commits the results:

```
every 6 hours, on GitHub's runners
  scrape Devfolio + Unstop + MLH
    → normalise to one shape, drop finished events, de-duplicate
    → write data/hackathons/**.json      (this repo IS the database)
    → label each one by topic with an LLM, cached so re-runs are free
    → bundle into one file the browser downloads
  commit → GitHub Pages serves the static site
```

Nothing runs between visits, so the whole thing costs nothing to operate and there is no server to
fall over at 2am.

The data lives in this repo as plain JSON. That gives full history through git, and means a
correction can arrive as a pull request that a human reads before merging.

## Status

| Working | Not yet |
|---|---|
| 262 hackathons, refreshed every 6 hours | Idea generation |
| Topic categories and filters | Hackathon detail pages |
| 675 verified past winners collected | Using winners to suggest ideas |
| Daily canary that files an issue when a scraper breaks | Community submissions |

## Running it locally

```bash
# Backend — scraping, labelling, export
cd backend
uv venv && uv pip install -e ".[dev]"
uv run python -m app.jobs.ingest        # fetch hackathons into data/
uv run python -m app.jobs.export_site   # build the bundle the site reads
uv run pytest                           # tests run offline against saved fixtures

# Frontend
cd ../frontend
npm install
npm run dev
```

No API keys are needed. Labelling defaults to a fake provider, so tests and local development
never spend quota or require secrets. To use the real one, set `GEMINI_API_KEY` and pass
`--provider gemini`.

## Layout

| Path | What it is |
|---|---|
| `backend/app/sources/` | One adapter per site. Pure `parse()` + `fetch()`, tested against saved fixtures. |
| `backend/app/winners/` | Finds past winners on GitHub and decides whether a win claim is credible. |
| `backend/app/taxonomy.py` | Labels hackathons and projects against `data/taxonomy.yml`. |
| `backend/app/jobs/` | The scheduled entry points. |
| `data/` | The database: one JSON file per hackathon and per winner. |
| `frontend/` | Static React site; all filtering happens in the browser. |

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

The most useful contributions:

- **Fix a broken scraper.** Sites redesign; a daily canary opens an issue when one stops
  returning data. Adapters live in `backend/app/sources/`, with saved responses in
  `backend/tests/fixtures/` so you can work offline.
- **Add a source.** Implement `parse()` and `fetch()` returning `HackathonRecord`s.
- **Improve the taxonomy.** `data/taxonomy.yml` is a plain file; propose better categories.

Tests must pass (`uv run pytest` and `npm test`) and run without network access.

## Licence

Code is MIT. The collected data in `data/` is CC BY 4.0. Hackathon listings and project
descriptions belong to their original authors — we store facts and link back rather than
republishing their content.
