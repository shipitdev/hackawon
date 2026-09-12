"""Find hackathon-winning projects on GitHub.

GitHub is our main source of *verified* winners: Devfolio publishes no prize-to-project mapping and
Devpost's terms forbid scraping. The API is free, documented and explicitly permitted.

The approach is keyword search plus conservative claim parsing:
  1. Run several searches that surface repos likely to mention a win.
  2. Run `claims.extract_claim` over the description and topics.
  3. Keep only repos that credibly claim a win; everything else is discarded rather than guessed at.

Recall is deliberately traded for precision. A repo wrongly labelled a winner corrupts the
grounding that the idea engine depends on, and nobody would ever notice.
"""

from __future__ import annotations

import os
import subprocess
import time
from dataclasses import replace
from typing import Any

from app.models import ProjectRecord
from app.sources.base import PoliteClient
from app.winners.claims import Claim, extract_claim

NAME = "github"
SEARCH_URL = "https://api.github.com/search/repositories"

#: Measured yields on 2026-09-12: topic:hackathon-winner 99, "hackathon winner" 562,
#: topic:hackathon-project 2874 (mostly non-winners, so the claim parser does the filtering).
QUERIES = (
    "topic:hackathon-winner",
    '"hackathon winner" in:description',
    '"hackathon winning" in:description',
    '"1st place" hackathon in:description',
    '"first prize" hackathon in:description',
    '"winner of" hackathon in:description',
    '"grand prize" hackathon in:description',
    '"best hack" in:description',
    '"runner up" hackathon in:description',
    "topic:hackathon-project winner in:description",
)

PER_PAGE = 50
#: The search API allows 30 requests/minute when authenticated.
SEARCH_INTERVAL = 2.5


def _token() -> str | None:
    """Prefer an explicit token; fall back to the gh CLI so local runs need no setup."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    try:
        result = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=10, check=False
        )
        return result.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def claim_text(repo: dict[str, Any]) -> str:
    """Description plus topics — topics often carry the only signal (`hackathon-winner`)."""
    topics = " ".join(t.replace("-", " ") for t in (repo.get("topics") or []))
    return f"{repo.get('description') or ''} {topics}".strip()


def find_claim(repo: dict[str, Any]) -> tuple[Claim, str] | None:
    """Claim plus where it came from.

    A win described in prose ("1st place at HackTU") is much stronger evidence than a bare
    `hackathon-winner` topic tag, which is self-applied and says nothing about what was won.
    Roughly a quarter of matches are topic-only, so the distinction is recorded and surfaced
    rather than averaged away.
    """
    description = (repo.get("description") or "").strip()
    claim = extract_claim(description)
    if claim is not None:
        return claim, "description"

    topics = " ".join(t.replace("-", " ") for t in (repo.get("topics") or []))
    claim = extract_claim(f"{description} {topics}".strip())
    if claim is not None:
        # Halve the confidence: the tag asserts a win but offers nothing to check it against.
        return replace(claim, confidence=round(claim.confidence * 0.5, 2)), "topics"
    return None


def to_project(
    repo: dict[str, Any], claim: Claim, claim_source: str = "description"
) -> ProjectRecord:
    summary = (repo.get("description") or "").strip()
    tech = [t for t in [repo.get("language")] if t]
    tech += [
        t
        for t in (repo.get("topics") or [])
        if "hackathon" not in t and "winner" not in t and t not in tech
    ]
    return ProjectRecord(
        source=NAME,
        source_id=str(repo["id"]),
        title=repo.get("name") or repo["full_name"],
        url=repo["html_url"],
        evidence="winner",
        tagline=summary[:140] or None,
        summary=summary[:300] or None,
        hackathon_name=claim.hackathon_name,
        year=claim.year or _year_from(repo),
        prize=claim.prize or claim.placement,
        tech=tech[:10],
        repo_url=repo["html_url"],
        demo_url=repo.get("homepage") or None,
        raw={
            "stars": repo.get("stargazers_count"),
            "pushed_at": repo.get("pushed_at"),
            "confidence": claim.confidence,
            "placement": claim.placement,
            "claim_source": claim_source,
        },
    )


def _year_from(repo: dict[str, Any]) -> int | None:
    created = repo.get("created_at") or ""
    return int(created[:4]) if created[:4].isdigit() else None


def parse(payload: dict[str, Any]) -> list[ProjectRecord]:
    """Keep only the search results that credibly claim a win."""
    projects = []
    for repo in payload.get("items") or []:
        if not repo.get("id") or not repo.get("html_url"):
            continue
        found = find_claim(repo)
        if found is None:
            continue
        claim, claim_source = found
        projects.append(to_project(repo, claim, claim_source))
    return projects


def fetch(
    client: PoliteClient | None = None,
    queries: tuple[str, ...] = QUERIES,
    pages: int = 2,
) -> list[ProjectRecord]:
    token = _token()
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    owns_client = client is None
    client = client or PoliteClient(min_interval=SEARCH_INTERVAL)
    found: dict[str, ProjectRecord] = {}
    try:
        for query in queries:
            for page in range(1, pages + 1):
                response = client.get(
                    SEARCH_URL,
                    params={"q": query, "per_page": PER_PAGE, "page": page, "sort": "stars"},
                    headers=headers,
                )
                payload = response.json()
                for project in parse(payload):
                    found.setdefault(project.source_id, project)
                if len(payload.get("items") or []) < PER_PAGE:
                    break  # last page for this query
            time.sleep(0.5)
        return list(found.values())
    finally:
        if owns_client:
            client.close()
