"""Devfolio adapter.

The search endpoint is Elasticsearch-shaped. Omitting `type` returns the whole archive (~1,757
events); `type` only accepts `application_open` and `upcoming` — `ended`/`all` return 422.

Note: Devfolio publishes no mapping from prize to project, so winners cannot be derived here.
Its value is upcoming events plus sponsor-prize tracks, and submitted-project context.
"""

from __future__ import annotations

import re
from typing import Any

from app.models import HackathonRecord, ProblemSource
from app.sources.base import PoliteClient, parse_dt

NAME = "devfolio"
SEARCH_URL = "https://api.devfolio.co/api/search/hackathons"
PAGE_SIZE = 50
_URL = re.compile(r"https?://[^\s)\]>]+")


def _tracks(source: dict[str, Any]) -> list[str]:
    return [p["name"] for p in (source.get("prizes") or []) if p.get("name")]


def _sponsors(source: dict[str, Any]) -> list[str]:
    return [
        sponsor["name"]
        for tier in (source.get("sponsor_tiers") or [])
        for sponsor in (tier.get("sponsors") or [])
        if sponsor.get("name")
    ]


def _reg_deadline(source: dict[str, Any]):
    setting = source.get("hackathon_setting") or {}
    return parse_dt(setting.get("reg_ends_at"))


def _problem_sources(source: dict[str, Any]) -> list[ProblemSource]:
    description = source.get("desc")
    if not description or "problem" not in description.lower():
        return []
    sources = [
        ProblemSource(
            kind="inline",
            title="Published problem context",
            text=description[:4000],
            status="parsed",
        )
    ]
    seen = set()
    for url in _URL.findall(description):
        url = url.rstrip(".,")
        if url in seen:
            continue
        seen.add(url)
        lowered = url.lower()
        kind = (
            "google_doc"
            if "docs.google.com" in lowered or "drive.google.com" in lowered
            else "pdf"
            if ".pdf" in lowered
            else "external"
        )
        sources.append(
            ProblemSource(kind=kind, title="Published problem statement", url=url, status="linked")
        )
    return sources


def parse(payload: dict[str, Any]) -> list[HackathonRecord]:
    hits = (payload.get("hits") or {}).get("hits") or []
    records = []
    for hit in hits:
        s = hit.get("_source") or {}
        slug = s.get("slug")
        if not slug or not s.get("uuid"):
            continue
        records.append(
            HackathonRecord(
                source=NAME,
                source_id=s["uuid"],
                title=s.get("name") or slug,
                url=f"https://{slug}.devfolio.co/",
                tagline=s.get("tagline"),
                description=s.get("desc"),
                starts_at=parse_dt(s.get("starts_at")),
                ends_at=parse_dt(s.get("ends_at")),
                reg_deadline=_reg_deadline(s),
                mode="online" if s.get("is_online") else "in_person",
                city=s.get("city"),
                country=s.get("country"),
                themes=[t for t in (s.get("themes") or []) if isinstance(t, str)],
                tracks=_tracks(s),
                sponsors=_sponsors(s),
                problem_sources=_problem_sources(s),
                team_min=s.get("team_min"),
                team_max=s.get("team_size"),
                participants_count=s.get("participants_count"),
                projects_submitted=s.get("projects_submitted"),
                raw=s,
            )
        )
    return records


def fetch(client: PoliteClient | None = None) -> list[HackathonRecord]:
    """Fetch all currently-open hackathons; never publish a truncated batch."""
    owns_client = client is None
    client = client or PoliteClient()
    records = []
    seen = set()
    pages_seen = set()
    try:
        for page in range(100):
            payload = client.post(
                SEARCH_URL,
                json={"type": "application_open", "from": page * PAGE_SIZE, "size": PAGE_SIZE},
                headers={"Content-Type": "application/json"},
            ).json()
            hits = payload.get("hits")
            if not isinstance(hits, dict) or not isinstance(hits.get("hits"), list):
                raise ValueError("Invalid Devfolio search envelope")
            rows = hits["hits"]
            signature = frozenset(str(row.get("_source", {}).get("uuid")) for row in rows)
            if rows and signature in pages_seen:
                raise ValueError("Repeated Devfolio page")
            pages_seen.add(signature)
            for record in parse(payload):
                if record.source_id not in seen:
                    records.append(record)
                    seen.add(record.source_id)
            total = hits.get("total")
            total = total.get("value") if isinstance(total, dict) else total
            if total is not None and (type(total) is not int or total < 0):
                raise ValueError("Invalid Devfolio total")
            if (
                not rows
                or len(rows) < PAGE_SIZE
                or (total is not None and (page + 1) * PAGE_SIZE >= total)
            ):
                return records
        raise ValueError("Devfolio exceeded 100 pages")
    finally:
        if owns_client:
            client.close()
