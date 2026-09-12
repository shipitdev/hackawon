# Source fixtures

Real responses captured from each source, used so the adapter tests run offline and CI never
touches the live sites. Each file records what the source looked like on the date below; when a
scraper breaks, diff the live response against these.

| Path | Source | Captured | Endpoint |
|---|---|---|---|
| `devfolio/hackathons_open.json` | Devfolio | 2026-09-12 | `POST api.devfolio.co/api/search/hackathons` `{"type":"application_open","from":0,"size":3}` |
| `devfolio/hackathon_projects.json` | Devfolio | 2026-09-12 | `GET api.devfolio.co/api/hackathons/<uuid>/projects?page=1` (`page` is required) |
| `devfolio/project_detail.json` | Devfolio | 2026-09-12 | `GET api.devfolio.co/api/projects/<uuid>` |
| `unstop/hackathons.json` | Unstop | 2026-09-12 | `GET unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=5` |
| `mlh/events_snippet.html` | MLH | 2026-09-12 | `GET mlh.com/seasons/2027/events` (trimmed to 3 event cards; parse the schema.org microdata, not the Tailwind classes) |
| `github/search_hackathon_winner.json` | GitHub | 2026-09-12 | `GET api.github.com/search/repositories?q=topic:hackathon-winner` |

Note: Devfolio's API exposes no winner/prize-to-project mapping — `prizes` was empty on every
project sampled. See the design doc.
