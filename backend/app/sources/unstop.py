"""Unstop adapter — the richest source for Indian students (~6,300 hackathons).

Lives under `/api/public/*`, which Unstop's robots.txt explicitly allows.

Two quirks, both measured 2026-09-12:
  * Rows carry `end_date` but usually no `start_date`; the useful dates live in
    `regnRequirements` (`start_regn_dt` / `end_regn_dt`).
  * **`oppstatus=open` is essential.** Without it the endpoint returns all 6,304 hackathons ever
    listed, newest-first by internal id, of which ~1 in 30 is still open. With it you get the 162
    genuinely open ones. The row-level `status` field is useless for this — it reads `LIVE` on
    events that ended months ago.
"""

from __future__ import annotations

from typing import Any

from app.models import HackathonRecord
from app.sources.base import PoliteClient, parse_dt

NAME = "unstop"
SEARCH_URL = "https://unstop.com/api/public/opportunity/search-result"
PAGE_SIZE = 30

#: Unstop stores currency as a Font Awesome icon name.
_CURRENCY_BY_ICON = {"fa-rupee": "INR", "fa-dollar": "USD", "fa-euro": "EUR"}

_MODE_BY_REGION = {"offline": "in_person", "online": "online", "hybrid": "hybrid"}


def _prize(row: dict[str, Any]) -> tuple[int | None, str | None]:
    """Total advertised cash across prize rows."""
    total = 0
    currency = None
    for prize in row.get("prizes") or []:
        cash = prize.get("cash")
        if isinstance(cash, (int, float)) and cash > 0:
            total += int(cash)
            currency = currency or _CURRENCY_BY_ICON.get(prize.get("currency"))
    return (total or None), currency


def _url(row: dict[str, Any]) -> str | None:
    if row.get("seo_url"):
        return row["seo_url"]
    if row.get("public_url"):
        return f"https://unstop.com/{row['public_url'].lstrip('/')}"
    return None


def _themes(row: dict[str, Any]) -> list[str]:
    return [
        f["name"]
        for f in (row.get("filters") or [])
        if f.get("type") == "category" and f.get("name")
    ]


def parse(payload: dict[str, Any]) -> list[HackathonRecord]:
    rows = ((payload.get("data") or {}).get("data")) or []
    records = []
    for row in rows:
        url = _url(row)
        if not row.get("id") or not url:
            continue
        reg = row.get("regnRequirements") or {}
        prize_amount, prize_currency = _prize(row)
        records.append(
            HackathonRecord(
                source=NAME,
                source_id=str(row["id"]),
                title=row.get("title") or str(row["id"]),
                url=url,
                # `start_date` is almost always null here. Do NOT fall back to the registration
                # opening date: it is often months before the event and renders as a bogus range.
                starts_at=parse_dt(row.get("start_date")),
                ends_at=parse_dt(row.get("end_date")),
                reg_opens_at=parse_dt(reg.get("start_regn_dt")),
                reg_deadline=parse_dt(reg.get("end_regn_dt")),
                mode=_MODE_BY_REGION.get(row.get("region"), "unknown"),
                organiser=(row.get("organisation") or {}).get("name"),
                prize_amount=prize_amount,
                prize_currency=prize_currency,
                themes=_themes(row),
                team_min=reg.get("min_team_size"),
                team_max=reg.get("max_team_size"),
                participants_count=row.get("registerCount"),
                raw=row,
            )
        )
    return records


def fetch(client: PoliteClient | None = None, pages: int = 6) -> list[HackathonRecord]:
    """Page through currently-open hackathons (~162, so 6 pages of 30 covers them)."""
    owns_client = client is None
    client = client or PoliteClient()
    records: list[HackathonRecord] = []
    seen: set[str] = set()
    try:
        for page in range(1, pages + 1):
            response = client.get(
                SEARCH_URL,
                params={
                    "opportunity": "hackathons",
                    "oppstatus": "open",
                    "page": page,
                    "per_page": PAGE_SIZE,
                },
                headers={"Accept": "application/json"},
            )
            batch = parse(response.json())
            fresh = [r for r in batch if r.source_id not in seen]
            seen.update(r.source_id for r in fresh)
            if not fresh:
                break  # ran past the last page, or the API started repeating itself
            records.extend(fresh)
        return records
    finally:
        if owns_client:
            client.close()
