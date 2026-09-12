"""MLH adapter.

MLH redesigned its site (checked 2026-09-12): the old `.event-wrapper` / `.event-name` classes are
gone. We parse the schema.org microdata instead, which is markup they publish deliberately for
search engines and therefore far more stable than Tailwind class names.

Only a handful of MLH events are in India, so this is a cheap secondary source.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, unquote_plus, urlparse

from app.models import HackathonRecord
from app.sources.base import PoliteClient, parse_dt

NAME = "mlh"
SEASON_URL = "https://mlh.com/seasons/{season}/events"

_EVENT_SPLIT = re.compile(r'(?=<a[^>]*itemType="https://schema\.org/Event")')
_META = r'itemProp="{}"\s+content="([^"]*)"'
_HEADING = re.compile(r"<h[1-6][^>]*>(.*?)</h[1-6]>", re.S)
_TAG = re.compile(r"<[^>]+>")

_MODE_BY_ATTENDANCE = {
    "OnlineEventAttendanceMode": "online",
    "OfflineEventAttendanceMode": "in_person",
    "MixedEventAttendanceMode": "hybrid",
}


def _meta(block: str, prop: str) -> str | None:
    match = re.search(_META.format(prop), block)
    return match.group(1) if match else None


def _title(block: str) -> str | None:
    """Heading first; fall back to the tracking params MLH puts in the outbound link."""
    for raw in _HEADING.findall(re.sub(r"<svg.*?</svg>", "", block, flags=re.S)):
        text = _TAG.sub("", raw).replace("<!-- -->", "").strip()
        if text:
            return text
    href = re.search(r'href="([^"]+)"', block)
    if href:
        utm = parse_qs(urlparse(href.group(1).replace("&amp;", "&")).query).get("utm_content")
        if utm:
            return unquote_plus(utm[0])
    alt = re.search(r'alt="([^"]+?)(?: background)?"', block)
    return alt.group(1) if alt else None


def _source_id(url: str, title: str) -> str:
    """MLH event URLs look like /events/14416-global-hack-week-data."""
    match = re.search(r"/events/(\d+)", url)
    if match:
        return match.group(1)
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def parse(html: str, season: int | None = None) -> list[HackathonRecord]:
    records = []
    for block in _EVENT_SPLIT.split(html):
        if "schema.org/Event" not in block:
            continue
        url = _meta(block, "url")
        title = _title(block)
        if not url or not title:
            continue
        attendance = (_meta(block, "eventAttendanceMode") or "").rsplit("/", 1)[-1]
        city = _meta(block, "addressLocality")
        region = _meta(block, "addressRegion")
        records.append(
            HackathonRecord(
                source=NAME,
                source_id=_source_id(url, title),
                title=title,
                url=url,
                starts_at=parse_dt(_meta(block, "startDate")),
                ends_at=parse_dt(_meta(block, "endDate")),
                mode=_MODE_BY_ATTENDANCE.get(attendance, "unknown"),
                city=", ".join(p for p in (city, region) if p) or None,
                country=_meta(block, "addressCountry"),
                raw={"season": season, "url": url},
            )
        )
    return records


def fetch(client: PoliteClient | None = None, season: int = 2027) -> list[HackathonRecord]:
    owns_client = client is None
    client = client or PoliteClient()
    try:
        response = client.get(SEASON_URL.format(season=season))
        return parse(response.text, season=season)
    finally:
        if owns_client:
            client.close()
