"""Conservative public Hack2Skill metadata, respecting event-path exclusions."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote, unquote, urlparse
from urllib.robotparser import RobotFileParser

from app.eligibility import is_open_for_registration
from app.models import HackathonRecord, ProblemSource
from app.sources.base import USER_AGENT, PoliteClient, parse_dt
from app.sources.unstop import _plain_text, _problem_sources

NAME = "hack2skill"
ROOT = "https://hack2skill.com"
LIST_URL = f"{ROOT}/api/v1/innovator/public/event/public-list"
DETAIL_URL = f"{ROOT}/api/v1/event/{{slug}}/event-details"
_MODE = {"VIRTUAL": "online", "IN_PERSON": "in_person", "HYBRID": "hybrid"}
_PROBLEM_LABEL = re.compile(r"\b(problem(?:[ _-]+statements?)?|challenges?)\b", re.I)
_ID = re.compile(r"[A-Za-z0-9_-]+")
_LIST_FIELDS = ("_id", "title", "eventUrl", "registrationStart", "registrationEnd", "mode")


def shift_year(now: datetime, years: int) -> datetime:
    try:
        return now.replace(year=now.year + years)
    except ValueError:  # February 29 in a non-leap target year
        return now.replace(year=now.year + years, day=28)


def parse(payload: dict[str, Any]) -> list[HackathonRecord]:
    if payload.get("success") is not True or not isinstance(payload.get("data"), list):
        raise ValueError("Invalid Hack2Skill listing envelope")
    records = []
    for row in payload["data"]:
        if not isinstance(row, dict):
            raise ValueError("Invalid Hack2Skill listing row")
        if row.get("isHidden"):
            continue
        slug = row.get("eventUrl")
        if not slug:  # Unpublished rows have no public event page to verify or attribute.
            continue
        if (
            not _ID.fullmatch(str(row.get("_id") or ""))
            or not isinstance(slug, str)
            or not slug.strip()
            or unquote(slug) in {".", ".."}
            or any(char in unquote(slug) for char in "/\\?#")
            or any(ord(char) < 32 for char in unquote(slug))
        ):
            raise ValueError("Invalid Hack2Skill event identity")
        records.append(
            HackathonRecord(
                source=NAME,
                source_id=str(row["_id"]),
                title=row.get("title") or slug,
                url=f"{ROOT}/event/{quote(unquote(slug), safe='')}/",
                reg_opens_at=parse_dt(row.get("registrationStart")),
                reg_deadline=parse_dt(row.get("registrationEnd")),
                mode=_MODE.get(row.get("mode"), "unknown"),
                raw={key: row[key] for key in _LIST_FIELDS if key in row},
            )
        )
    return records


def _visible(value: Any) -> Any:
    """Strip hidden/deleted objects before reading any nested values."""
    if isinstance(value, dict):
        if value.get("isHidden") or value.get("isDeleted"):
            return None
        return {k: clean for k, v in value.items() if (clean := _visible(v)) is not None}
    if isinstance(value, list):
        return [clean for item in value if (clean := _visible(item)) is not None]
    return value


def parse_detail(record: HackathonRecord, payload: dict[str, Any]) -> HackathonRecord | None:
    data = payload.get("data")
    if payload.get("success") is not True or not isinstance(data, dict) or not data.get("type"):
        raise ValueError("Invalid Hack2Skill detail envelope")
    if data["type"] != "HACKATHON":
        return None
    data = _visible(data)
    if data is None:
        return None
    record = record.model_copy(deep=True)
    team = (data.get("tags") or {}).get("teamSize") or {}
    record.team_min = team.get("min")
    record.team_max = team.get("max")
    descriptions = []
    eligibility = []
    problems: list[ProblemSource] = []
    relevant = []
    for section in data.get("sections") or []:
        if section.get("type") in {"CONTACT_US", "TIMELINE"}:
            continue
        for category in section.get("category") or []:
            for item in category.get("data") or []:
                label = " ".join(
                    str(node.get(key) or "")
                    for node in (section, category, item)
                    for key in ("title", "type")
                )
                is_problem = bool(_PROBLEM_LABEL.search(label))
                about = section.get("type") == "ABOUT"
                overview = (
                    section.get("type") == "OVERVIEW" and category.get("type") == "ELIGIBILTY"
                )
                if not (about or overview or is_problem):
                    continue
                # Allowlist only the fields we actually publish; no contacts/counters/timelines.
                fields = {
                    key: item[key]
                    for key in ("title", "description", "value", "link", "eligibility", "prize")
                    if key in item
                }
                if is_problem:
                    fields["content"] = [
                        {
                            key: child[key]
                            for key in ("title", "description", "value", "link")
                            if key in child
                        }
                        for child in item.get("content") or []
                        if isinstance(child, dict)
                    ]
                relevant.append(
                    {
                        "section": section.get("type"),
                        "category": category.get("type"),
                        "item": fields,
                    }
                )
                if about:
                    text = _plain_text(item.get("description"), limit=2000)
                    if text:
                        descriptions.append(text)
                if overview:
                    text = _plain_text(item.get("eligibility"))
                    if text:
                        eligibility.append(text)
                    text = _plain_text(str(item.get("prize") or ""))
                    if text:
                        descriptions.append(f"Advertised prize: {text}")
                if is_problem:
                    for entry in [fields, *fields.get("content", [])]:
                        html = entry.get("description") or entry.get("value") or ""
                        if not isinstance(html, str):
                            continue
                        title = _plain_text(entry.get("title")) or "Published challenge"
                        text = _plain_text(html, limit=4000)
                        if text and not text.startswith(("https://", "http://")):
                            problems.append(
                                ProblemSource(
                                    kind="inline", title=title, text=text, status="parsed"
                                )
                            )
                        problems.extend(
                            p for p in _problem_sources(f"Problem statement: {html}") if p.url
                        )
                        url = entry.get("link") or (
                            html if html.startswith(("https://", "http://")) else None
                        )
                        if isinstance(url, str) and url.startswith(("https://", "http://")):
                            kind = (
                                "google_doc"
                                if urlparse(url).hostname in {"docs.google.com", "drive.google.com"}
                                else "pdf"
                                if ".pdf" in url.lower()
                                else "external"
                            )
                            problems.append(
                                ProblemSource(kind=kind, title=title, url=url, status="linked")
                            )
    record.description = "\n\n".join(descriptions) or None
    record.eligibility_text = "\n".join(eligibility) or None
    record.problem_sources = list({(p.kind, p.url, p.text): p for p in problems}.values())
    record.raw = {
        **record.raw,
        "detail": {
            "type": "HACKATHON",
            "teamSize": {k: team[k] for k in ("min", "max") if k in team},
            "sections": relevant,
        },
    }
    return record


def fetch(client: PoliteClient | None = None) -> list[HackathonRecord]:
    owns_client = client is None
    client = client or PoliteClient()
    records = []
    seen = set()
    pages_seen = set()
    now = datetime.now(UTC)
    try:
        robots_text = client.get(f"{ROOT}/robots.txt").text
        if not re.search(r"^User-agent:", robots_text, re.I | re.M):
            raise ValueError("Invalid Hack2Skill robots file")
        robots = RobotFileParser()
        robots.parse(robots_text.splitlines())
        # Conservative prefix rule even if a more-specific Allow appears later.
        blocked = [
            unquote(m.group(1).strip())
            for m in re.finditer(r"^Disallow:\s*(/event/[^\r\n#]*)", robots_text, re.I | re.M)
        ]
        for page in range(1, 101):
            payload = client.get(
                LIST_URL,
                params={
                    "page": page,
                    "records": 9,
                    "search": "",
                    "start": shift_year(now, -2).isoformat(),
                    "end": shift_year(now, 1).isoformat(),
                },
            ).json()
            batch = parse(payload)
            last_page = payload.get("pages")
            if type(last_page) is not int or last_page < page:
                raise ValueError("Invalid Hack2Skill pages")
            signature = frozenset(str(row.get("_id")) for row in payload["data"])
            if payload["data"] and signature in pages_seen:
                raise ValueError("Repeated Hack2Skill page")
            if not payload["data"] and page < last_page:
                raise ValueError("Empty Hack2Skill page before last page")
            pages_seen.add(signature)
            for record in batch:
                path = unquote(urlparse(record.url).path)
                if (
                    record.source_id in seen
                    or not is_open_for_registration(record, now)
                    or any(path.startswith(prefix) for prefix in blocked)
                    or not robots.can_fetch(USER_AGENT, record.url)
                ):
                    continue
                seen.add(record.source_id)
                slug = quote(unquote(record.raw["eventUrl"]), safe="")
                verified = parse_detail(record, client.get(DETAIL_URL.format(slug=slug)).json())
                if verified is not None:
                    records.append(verified)
            if page == last_page:
                return records
        raise ValueError("Hack2Skill exceeded 100 pages")
    finally:
        if owns_client:
            client.close()
