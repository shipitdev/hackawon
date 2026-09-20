"""Pick which past winners should inform ideas for a given hackathon.

Deliberately not "what won at this exact event last year". That data barely exists: first editions
have no history, themes change yearly, and matching event names across years is unreliable. Instead
both sides are labelled against a shared taxonomy, and we match on category — so every hackathon
gets usable grounding and a small winners corpus goes much further.

Pure scoring in Python: no SQL features, no embeddings, so it behaves identically on SQLite,
Postgres or plain files.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

from app.models import HackathonRecord, ProjectRecord
from app.taxonomy import normalise_domains

#: Below this many exemplars a category's advice is too thin to state confidently.
THIN_EVIDENCE = 5

#: Weights are relative, not absolute — only their ratios matter.
W_DOMAIN = 3.0
W_EVIDENCE = 2.0
W_RECENCY = 1.5
W_NAMED = 0.5
W_NOT_GENERAL = 0.5
W_PROBLEM = 0.75
_WORD = re.compile(r"[a-z0-9]{5,}")


@dataclass(frozen=True)
class Match:
    project: ProjectRecord
    score: float
    shared_domains: list[str]


@dataclass(frozen=True)
class Grounding:
    """What the idea prompt gets, plus an honest account of how solid it is."""

    matches: list[Match]
    domains: list[str]
    patterns: list[tuple[str, int]]
    thin: bool

    @property
    def exemplars(self) -> list[ProjectRecord]:
        return [m.project for m in self.matches]


def _recency(year: int | None, now_year: int) -> float:
    """Recent wins reflect what judges currently reward. Old ones still count for something."""
    if not year:
        return 0.3
    age = max(0, now_year - year)
    if age <= 1:
        return 1.0
    if age <= 3:
        return 0.7
    if age <= 5:
        return 0.4
    return 0.2


def score(
    hackathon_domains: list[str],
    project: ProjectRecord,
    labels: dict[str, Any],
    now_year: int,
    problem_terms: set[str] | None = None,
) -> tuple[float, list[str]]:
    project_domains = normalise_domains(labels.get("domains"))
    shared = [d for d in project_domains if d in hackathon_domains and d != "general"]

    total = W_DOMAIN * len(shared)

    # A win described in prose beats a self-applied topic tag; see winners/github.py.
    if (project.raw or {}).get("claim_source") == "description":
        total += W_EVIDENCE * float((project.raw or {}).get("confidence") or 0.5)

    total += W_RECENCY * _recency(project.year, now_year)

    # Knowing which hackathon it won makes an exemplar far more persuasive to a student.
    if project.hackathon_name:
        total += W_NAMED
    if project_domains and project_domains != ["general"]:
        total += W_NOT_GENERAL

    if problem_terms:
        project_text = " ".join(
            [project.title, project.tagline or "", project.summary or "", " ".join(project.tech)]
        ).lower()
        total += W_PROBLEM * min(3, len(problem_terms & set(_WORD.findall(project_text))))

    return total, shared


#: Cap per domain when spreading, so a themeless hackathon sees variety rather than eight AI apps.
MAX_PER_DOMAIN = 2


def _diverse(
    scored: list[Match], project_labels: dict[str, dict[str, Any]], limit: int
) -> list[Match]:
    """Take the strongest winners while capping how many come from any one domain."""
    used: Counter[str] = Counter()
    chosen: list[Match] = []
    for match in scored:
        domains = normalise_domains(project_labels.get(match.project.uid, {}).get("domains"))
        key = domains[0] if domains else "general"
        if used[key] >= MAX_PER_DOMAIN:
            continue
        used[key] += 1
        chosen.append(match)
        if len(chosen) >= limit:
            break
    # If the cap was too strict to fill the quota, top up with the next best regardless.
    if len(chosen) < limit:
        taken = {m.project.uid for m in chosen}
        chosen += [m for m in scored if m.project.uid not in taken][: limit - len(chosen)]
    return chosen


def match_winners(
    hackathon: HackathonRecord,
    hackathon_domains: list[str],
    projects: list[ProjectRecord],
    project_labels: dict[str, dict[str, Any]],
    now_year: int,
    limit: int = 8,
) -> Grounding:
    """Rank `projects` for one hackathon and report how well-grounded the result is."""
    specific = [d for d in hackathon_domains if d != "general"]
    problem_terms = set(
        _WORD.findall(" ".join(source.text or "" for source in hackathon.problem_sources).lower())
    )

    scored: list[Match] = []
    for project in projects:
        labels = project_labels.get(project.uid)
        if not labels:
            continue
        value, shared = score(hackathon_domains, project, labels, now_year, problem_terms)
        if shared:
            scored.append(Match(project, value, shared))

    on_topic = len(scored)

    # Fall back to generally strong winners rather than showing nothing.
    if on_topic < THIN_EVIDENCE:
        for project in projects:
            labels = project_labels.get(project.uid)
            if not labels or any(m.project.uid == project.uid for m in scored):
                continue
            value, _ = score(hackathon_domains, project, labels, now_year, problem_terms)
            scored.append(Match(project, value * 0.4, []))

    scored.sort(key=lambda m: (-m.score, -(m.project.year or 0), m.project.title))

    if specific:
        top = scored[:limit]
    else:
        # A themeless hackathon ("build anything") has no on-topic set to find, so the useful
        # grounding is a SPREAD of strong winners rather than the top of one category — which
        # would otherwise be eight AI projects, since AI dominates the corpus.
        top = _diverse(scored, project_labels, limit)

    patterns = Counter(
        pattern
        for m in top
        for pattern in (project_labels.get(m.project.uid, {}).get("winning_patterns") or [])
    )

    return Grounding(
        matches=top,
        domains=specific,
        patterns=patterns.most_common(4),
        # "Thin" means we expected on-topic evidence and did not find it. A themeless hackathon
        # never had an on-topic set to begin with, so flagging it would put a warning on most
        # pages and train students to ignore the one that matters.
        thin=bool(specific) and on_topic < THIN_EVIDENCE,
    )
