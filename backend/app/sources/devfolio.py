"""Devfolio adapter.

The search endpoint is Elasticsearch-shaped. Omitting `type` returns the whole archive (~1,757
events); `type` only accepts `application_open` and `upcoming` — `ended`/`all` return 422.

Note: Devfolio publishes no mapping from prize to project, so winners cannot be derived here.
Its value is upcoming events plus sponsor-prize tracks, and submitted-project context.
"""

from __future__ import annotations

from typing import Any

from app.models import HackathonRecord
from app.sources.base import PoliteClient, parse_dt

NAME = "devfolio"
SEARCH_URL = "https://api.devfolio.co/api/search/hackathons"
PAGE_SIZE = 50


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
                team_min=s.get("team_min"),
                team_max=s.get("team_size"),
                participants_count=s.get("participants_count"),
                projects_submitted=s.get("projects_submitted"),
                raw=s,
            )
        )
    return records


def fetch(client: PoliteClient | None = None, limit: int = PAGE_SIZE) -> list[HackathonRecord]:
    """Fetch currently-open hackathons."""
    owns_client = client is None
    client = client or PoliteClient()
    try:
        response = client.post(
            SEARCH_URL,
            json={"type": "application_open", "from": 0, "size": limit},
            headers={"Content-Type": "application/json"},
        )
        return parse(response.json())
    finally:
        if owns_client:
            client.close()
