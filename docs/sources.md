# Source coverage

Checked 2026-09-27. These are observed website endpoints, not documented official APIs or permission to republish content. Hackawon remains free and noncommercial; retain factual metadata, short context and source attribution only.

| Source | Mode | Access decision |
| --- | --- | --- |
| devfolio | import | Public search; robots allow crawling; reviewed terms have no explicit scraping clause. Submissions are not winners. |
| unstop | import | Robots allow `/api/public/*`; keep `oppstatus=open`. |
| mlh | import | Public calendar microdata; terms prohibit commercial use. |
| hack2skill | import | Public listing/details; exclude robots-blocked event prefixes and hidden fields. Participation terms do not grant redistribution rights. |
| devpost | discovery link | Terms section 4 prohibits automated access; no authorized bulk feed established. |
| hackerearth | discovery link | Terms restrict unauthorized redistribution; documented v4 API runs code, not discovery. |

## Endpoint recipes and fields

- Devfolio: POST `https://api.devfolio.co/api/search/hackathons`, JSON `{"type":"application_open","from":OFFSET,"size":50}`. Advance by 50; `hits.total.value` supplies total. `_source.uuid/slug/name` supply identity, URL and title; event dates stay separate from registration settings.
- Unstop: GET `https://unstop.com/api/public/opportunity/search-result`, `opportunity=hackathons&oppstatus=open&page=PAGE&per_page=30`. Traverse `data.last_page`; ID deduplication. `start_date/end_date` are event dates; `regnRequirements.start_regn_dt/end_regn_dt` are registration dates.
- MLH: GET `https://mlh.com/seasons/YEAR/events`; schema.org Event microdata supplies dates, mode, city, country and organizer URL. Season is UTC year before July, next year from July. Keep IDs and explicit season override.
- Hack2Skill: GET `https://hack2skill.com/api/v1/innovator/public/event/public-list`, `page=PAGE&records=9&search=&start=UTC_MINUS_TWO_YEARS&end=UTC_PLUS_ONE_YEAR`. Calendar shifts clamp February 29 to February 28. Traverse top-level `pages`; require `success=true`, list `data`. `_id/title/eventUrl` map to identity/title/`https://hack2skill.com/event/{eventUrl}/`; `registrationStart/registrationEnd` map only to registration. VIRTUAL/IN_PERSON/HYBRID map to online/in_person/hybrid. Submission dates are never event dates. Rows without a public event URL are omitted; slugs with spaces are URL-encoded, and robots prefix checks use decoded paths.
- Read `https://hack2skill.com/robots.txt` once, fail if unavailable, and exclude plain `/event/...` Disallow prefixes before details. GET `https://hack2skill.com/api/v1/event/{eventUrl}/event-details`; require `data.type=HACKATHON`. Visible `tags.teamSize.min/max`, ABOUT descriptions, OVERVIEW → ELIGIBILTY eligibility/prize, and explicitly labelled problem/challenge text/links only. Hidden sections/categories/items/tags are omitted, including from raw. Unsupported prizes remain text; unknown location, sponsors and themes remain empty. Detail failure fails the batch.
- HackerEarth observed website listing: `https://www.hackerearth.com/chrome-extension/events/` (historical and mixed competition types; permission-backed integration only). Discovery: `https://www.hackerearth.com/challenges/`.
- Devpost discovery: `https://devpost.com/hackathons`. No adapter or placeholder feed.

All paginated adapters stop at 100 pages and raise if unfinished or repeated. Failed batches do not overwrite stored current listings. Existing GitHub winners, schedules, classification and export remain in use.

References: [Devfolio terms](https://devfolio.co/terms-of-use), [robots](https://devfolio.co/robots.txt); [Unstop robots](https://unstop.com/robots.txt); [MLH terms](https://www.mlh.com/terms); [Hack2Skill robots](https://hack2skill.com/robots.txt), [terms](https://hack2skill.com/legacy/tnc); [Devpost terms](https://info.devpost.com/legal/terms-of-service); [HackerEarth terms](https://www.hackerearth.com/terms-of-service), [API docs](https://www.hackerearth.com/docs/wiki/developers/v4/).

## Implementation checklist

- [x] Record access decisions
- [x] Fix Devfolio and Unstop pagination
- [x] Select MLH season automatically
- [x] Ingest Hack2Skill listings with robots exclusions
- [x] Parse visible Hack2Skill details
- [x] Connect ingestion, eligibility and discovery links
- [x] Offline checks, live dry run, temporary export and production build

## Verification (2026-09-27)

`make check`: 177 offline backend tests, 65 frontend tests, Ruff and TypeScript passed.
The eight-page Unstop fixture imports all 218 rows. Repetition, premature empty pages,
malformed envelopes, safety ceilings, leap years, hidden fields and source failure retention
are covered. The source failure test uses a temporary store and health history.

Live `python -m app.jobs.ingest --dry-run` completed without writing stored data:

| Source | Fetched | Current |
| --- | ---: | ---: |
| devfolio | 27 | 27 |
| unstop | 209 | 209 |
| mlh | 101 | 71 |
| hack2skill | 6 | 6 |

313 current records became 312 after the existing deduplication rule. Hack2Skill traversed
37 listing pages; its fetched count is the verified, public, registration-open hackathon
batch, after exclusions. Counts can change as registration closes.

One live AI for Foundational Learning Hackathon record was written only to a temporary
data directory, exported and passed through the existing idea prompt builder. The production
build passed. Its prerendered detail page and imported-source filter were checked in a browser;
source attribution, unknown event dates, team size and the two external discovery links rendered
correctly, with no browser console errors. Optional eligibility and old bundles are covered
by frontend tests. No scheduled rollout or deployment was performed.
