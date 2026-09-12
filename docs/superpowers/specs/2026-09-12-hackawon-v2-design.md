# Hackawon v2 — search, identity, discoverability, toolkit

## Context

Hackawon is live at <https://shipitdev.github.io/hackawon/>: 264 open hackathons from Devfolio,
Unstop and MLH, categorised into 15 topics, with 1,310 generated project ideas grounded in 675
verified past winners. It runs entirely on scheduled GitHub Actions and GitHub Pages at no cost.

This round fixes a real defect, settles the product's identity, makes it discoverable, and adds a
toolkit page — while laying the boundary that lets user accounts arrive later without rewriting
what exists.

### The defect

Search appeared broken. It is not: it searches the wrong fields. `haystack()` in
`frontend/src/lib.ts` scans title, tagline, organiser, city, country, themes, tracks and sponsors
— but **not the topic labels we generate, nor the description excerpt**. Measured: typing
"fintech" returns 2 results while 13 hackathons carry the Fintech label. "Buildonomics", "Glimpse
Trading Hackathon 2026" and "Tejas India Hackathon 2026" are all fintech events that cannot be
found by searching for fintech.

### Decisions taken in this round

| Decision | Reason |
|---|---|
| Rename to **Hackawon** | Repo, URL and product name disagreed (`hackawon` / HackRadar / hackawon). |
| Quiet source attribution, keep the register link | A hero line naming three sources does not scale to twenty; the outbound button credits each source exactly where it is useful. |
| Idea-forward cards | 1,310 hackathon-specific ideas are currently invisible until a click. It is the only content no competing aggregator has. |
| Real URLs + prerendered pages | Detail lives in a modal with no URL: nobody can share a hackathon, and Google sees an empty div. |
| Toolkit as a standalone page | Ships fast. Marked explicitly as early/in-development so it can grow. |
| Deliberately deferred | Tool↔hackathon matching, automated freshness checks, analytics, the `sponsor-tech` relabel. |

## Step 1 — Corrections

Small, contained, all in files that already exist.

**Search.** Add topic labels and the excerpt to the search haystack. Labels must match what a
student types ("AI", not `ai-ml`), so `export_site.py` denormalises a `topic_labels: string[]`
onto each exported record — roughly 20 bytes each. `haystack()` gains both fields.

*Verification:* a test asserting "fintech" matches every record labelled Fintech, and that a word
appearing only in the description is findable.

**Identity.** Replace HackRadar with Hackawon in `index.html`, the hero, the footer and the README.

**Attribution.** Remove the per-card source badge and the hero subtitle naming sources. Keep the
"Register on …" button. Add a one-line credit in the footer.

**Idea-forward cards.** `export_site.py` adds `idea_teaser: string | null` — the first idea's
title only (~50 chars; ~13 KB across 264 records, versus the 988 KB of full ideas that was
correctly removed from the index). The card renders it as a teaser line. The full set still loads
on demand when the card is opened.

**Create the `DataSource` seam.** Today `fetch()` calls sit inline in `App.tsx` and `Detail.tsx`.
Move both into a single `frontend/src/data.ts` exposing `loadIndex()` and `loadIdeas(uid)`. This
is a small refactor with no behaviour change, and it is the seam the future authenticated service
plugs into — adding a backend then means adding an implementation here, not editing components.

## Step 2 — Findable and shareable

**Routes.** `/` for the list, `/h/<slug>` per hackathon. The slug is
`<title-slug>-<first 8 of source_id>`, generated in the exporter and stored on the record so the
frontend and the prerenderer cannot disagree. Opening a card pushes the route; closing pops it, so
the browser back button works.

**Prerender.** A build step renders each route to static HTML with `react-dom/server`, using the
same components as the SPA so there is one source of truth. Each page carries a real `<title>`,
meta description, and OG/Twitter tags built from the hackathon's own fields. Plus `sitemap.xml`
and `robots.txt`.

*Risk and fallback:* this changes the build from "bundle a SPA" to "render every route", which is
the riskiest part of this spec. If Vite SSR fights us, the fallback is a small Node script that
emits a simple static HTML page per hackathon which links into the app — less elegant, same
discoverability benefit.

*Verification:* `curl` a hackathon URL and find its title and ideas in the HTML without running
JavaScript; `sitemap.xml` lists every hackathon; the back button returns to the list.

## Step 3 — Toolkit

`data/tools.yml`, hand-curated and JSON-Schema validated in CI, exported to
`frontend/public/data/tools.json` and served at `/tools`.

Each entry records **what you actually get**, because that is the useful part and the part that
rots:

```yaml
- name: Supabase
  url: https://supabase.com
  category: auth
  what_you_get: "Free: Postgres 500 MB, 50k monthly active users, auth included"
  free: true
  notes: Projects pause after ~1 week idle.
  checked: 2026-09-12
```

Categories: `ai-credits`, `auth`, `database`, `hosting`, `slides`, `ui-kits`, `datasets`,
`dev-tools`.

**The page states plainly that it is early and incomplete**, with a link to contribute an entry.
This is deliberate: a half-empty list that admits it is half-empty invites contributions, while one
that pretends to be authoritative just looks wrong.

**Freshness is the known weakness.** Free tiers change constantly — during this project Gemini's
`2.5-flash-lite` began returning 404 for new keys within weeks. Every entry therefore carries a
`checked` date shown in the UI, and entries older than 90 days are visibly marked stale. Automated
verification is deferred, not forgotten.

## The distributed boundary (for accounts, favourites and reminders)

The stated direction is user registration, tracking which hackathons a user is participating in and
has favourited, and sending deadline reminders. That is the first requirement here that genuinely
needs a server. Nothing in this round builds it; this section fixes the boundary so it can arrive
without rewriting what exists.

**The principle: public data stays static; only per-user state gets a service.**

Hackathon listings, topics, ideas and tools are identical for every visitor and change a few times
a day. Serving them as static files on a CDN is faster, free, and cannot fall over. Moving them
into Postgres because accounts arrived would add cost and fragility for no gain. So:

| Concern | Where it lives | Why |
|---|---|---|
| Listings, ideas, topics, tools | Static JSON on a CDN, built by GitHub Actions | Public, identical for all, no per-request work |
| Accounts, favourites, participation, reminder prefs | Postgres behind an authenticated API | Per-user, mutable, private |
| Reminder delivery | Scheduled job reading favourites against deadlines | Needs both halves |

**What this round must not break:**

1. **`DataSource` seam in the frontend** — created in Step 1. All reads go through
   `src/data.ts`, which today fetches static JSON. Adding a service means adding a second
   implementation there, not editing components.
2. **No cloud-specific SDKs**, config from environment variables only — already a standing rule.
3. **DB-agnostic queries.** Ranking and filtering stay in Python, so SQLite → Postgres is one env
   var. Already true; keep it true.
4. **Stable public ids.** `uid` (`source:source_id`) and the new `slug` are the join keys a future
   `favourites` table will reference. They must not be regenerated on a whim; the slug is derived
   from fields that do not drift.

**When it is built** (not now): Supabase is the likely fit — Postgres, auth and row-level security
on a free tier, which keeps per-user data cheap at small scale. The FastAPI app in the original
plan was never written; accounts are what will justify writing it, containerised so it can run on
any host. Reminders need a transactional email provider and a scheduled job, neither of which
exists yet.

## Not doing

Tool↔hackathon track matching · automated tool freshness checks · analytics · the `sponsor-tech`
relabel · accounts, favourites or reminders themselves · any hosted database.

## Verification for the whole round

- `pytest` and `vitest` pass; ruff and `tsc` clean.
- "fintech" finds all 13 fintech-labelled hackathons.
- No occurrence of "HackRadar" remains in the repo.
- A card shows a real generated idea title; no source badge appears on cards.
- `curl https://…/h/<slug>` returns the hackathon's title and ideas in raw HTML.
- `/tools` lists entries with `checked` dates and says it is early.
- The initial data download stays under ~60 KB gzipped.
