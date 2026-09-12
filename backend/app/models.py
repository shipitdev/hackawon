"""Shared record shapes.

Every source adapter normalises to `HackathonRecord`, so the ingest job, the ranking code and the
frontend never need to know which site a hackathon came from.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Mode = Literal["in_person", "online", "hybrid", "unknown"]

# How much we actually know about a past project. Never show a `submitted` project as a winner:
# Devfolio publishes no prize-to-project mapping, so most of our corpus is unverified.
Evidence = Literal["winner", "submitted"]


class HackathonRecord(BaseModel):
    source: str
    source_id: str
    title: str
    url: str

    tagline: str | None = None
    description: str | None = None

    #: When the hackathon itself runs. Leave None rather than substituting a registration date —
    #: Unstop rarely publishes an event start, and pretending otherwise produced date ranges like
    #: "4 Mar – 25 Oct" (registration opening to event end).
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    reg_opens_at: datetime | None = None
    reg_deadline: datetime | None = None

    mode: Mode = "unknown"
    city: str | None = None
    country: str | None = None

    organiser: str | None = None
    prize_amount: int | None = None
    prize_currency: str | None = None

    themes: list[str] = Field(default_factory=list)
    #: Sponsor prizes and prize categories — the signal that makes generated ideas specific.
    tracks: list[str] = Field(default_factory=list)
    sponsors: list[str] = Field(default_factory=list)

    team_min: int | None = None
    team_max: int | None = None
    participants_count: int | None = None
    projects_submitted: int | None = None

    #: The untouched payload, so a parser fix can be replayed without re-scraping.
    raw: dict[str, Any] = Field(default_factory=dict)

    @property
    def uid(self) -> str:
        return f"{self.source}:{self.source_id}"


class ProjectRecord(BaseModel):
    """A past hackathon project — either a verified winner or a submission."""

    source: str
    source_id: str
    title: str
    url: str
    evidence: Evidence

    tagline: str | None = None
    summary: str | None = None
    hackathon_name: str | None = None
    year: int | None = None
    prize: str | None = None

    tech: list[str] = Field(default_factory=list)
    repo_url: str | None = None
    demo_url: str | None = None

    raw: dict[str, Any] = Field(default_factory=dict)

    @property
    def uid(self) -> str:
        return f"{self.source}:{self.source_id}"
