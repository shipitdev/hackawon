# The data

This directory is the database. Plain files, versioned in git — so every change has history, and
corrections arrive as pull requests a human reads before merging.

`taxonomy.yml` and `tools.yml` are edited by hand and live on `main`. Everything else is generated
by the jobs in `backend/app/jobs/` and lives on the **`data` branch**, so main's history stays
readable. Run `scripts/data-branch.sh pull` to copy it here. Edit the scrapers, not the output.

| Path | Written by | What it holds |
|---|---|---|
| `taxonomy.yml` | **humans** | The category vocabulary. Edit this to change how things are labelled. |
| `tools.yml` | **humans** | The hackathon toolkit page. |
| `hackathons/<source>/<id>.json` | `jobs/ingest` | One upcoming hackathon, normalised across sources. |
| `winners/<source>/<id>.json` | `jobs/ingest_winners` | One past project that credibly claims a win. |
| `labels/hackathons.json` | `jobs/classify` | uid → domains, with a content hash for caching. |
| `labels/winners.json` | `jobs/classify` | uid → domains, archetype, winning patterns. |
| `ideas/<uid>.json` | `jobs/generate_ideas` | Five generated ideas plus what grounded them. |
| `source_runs.json` | `jobs/ingest` | Last outcome per source; drives the canary. |

## Things worth knowing before you change anything

**Labels are cached by content hash plus `taxonomy.version`.** Re-running the classifier costs
nothing unless an item's text changed. If you edit `taxonomy.yml` in a way that should change
existing labels, **bump `version`** — otherwise every cached label is kept and your change does
nothing.

**`winners/*.json` carries its own evidence.** `raw.claim_source` is `description` when the win was
stated in prose (checkable) or `topics` when it came only from a self-applied GitHub topic
(unverifiable, so confidence is halved). Ranking prefers the former. Roughly 92% are `description`.

**Not every winner has a reason.** About half have an empty `winning_patterns`, because most repo
descriptions say "1st place at X" and nothing more. That is the honest answer; the prompt forbids
inventing one. Please don't "fix" it by loosening the prompt.

**`general` means no theme, not unknown.** Most student hackathons genuinely set no subject.
`normalise_domains()` strips `general` when specific domains are also present.

## Licence

The collected data is CC BY 4.0. Listings and project descriptions belong to their original
authors: we store facts and link back rather than republishing their content.
