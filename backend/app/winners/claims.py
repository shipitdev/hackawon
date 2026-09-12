"""Decide whether a piece of text claims a hackathon win, and pull out the details.

This is deliberately conservative. Devfolio publishes no winner data and Devpost is off-limits, so
GitHub is our main source of *verified* winners — and a false positive here silently corrupts the
grounding the idea engine is built on. When in doubt, return None and let the project fall back to
`submitted`.

Pure text in, structured claim out: no network, no LLM, fully testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

#: Strong context: the text is unambiguously about a hackathon. Matches anything containing
#: "hack" as a word part, so event names like "HackTU 3.0" and "ICHack" count.
_STRONG_CONTEXT = re.compile(r"\b\w*hack\w*\b|\b\w*jam\b|\bbuildathon\b|\bhackfest\b", re.I)

#: Weak context: "challenge" is used by plenty of non-hackathon repos (Advent of Code, LeetCode),
#: so on its own it only counts when paired with an explicit placement like "1st place".
_WEAK_CONTEXT = re.compile(r"\bchallenge\b", re.I)

#: Phrases that mean "I took part", which is the most common near-miss.
_PARTICIPATION_ONLY = re.compile(
    r"\b(submission|submitted|my entry for|our entry for|participat\w+|attended|"
    r"did\s+not\s+win|didn'?t\s+win)\b",
    re.I,
)

# Ordered most specific first: the first match becomes the reported placement.
_PLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(1st|first)[\s\-]*place\b", re.I), "1st place"),
    (re.compile(r"\b(1st|first)[\s\-]*prize\b", re.I), "first prize"),
    (re.compile(r"\bgrand\s+prize\b", re.I), "grand prize"),
    (re.compile(r"\b(2nd|second)[\s\-]*(place|prize)\b", re.I), "2nd place"),
    (re.compile(r"\b(3rd|third)[\s\-]*(place|prize)\b", re.I), "3rd place"),
    (re.compile(r"\brunner[\s\-]?up\b", re.I), "runner-up"),
    (re.compile(r"\bwinning\s+(entry|project|submission)\b", re.I), "winning entry"),
    (re.compile(r"\bwinner\b", re.I), "winner"),
    (re.compile(r"\bwon\b", re.I), "won"),
]

#: Named awards, e.g. "Best Hardware Hack", "Most Creative".
_NAMED_PRIZE = re.compile(
    r"\b((?:best|most)\s+[\w&/\-]+(?:\s+[\w&/\-]+){0,3}?)\b(?=\s*[\"'”»)\]]?(?:\s|$|,|\.|\-|//|@))",
    re.I,
)

_TROPHY = re.compile(r"[🏆🥇🏅]")

#: A capitalised phrase ending in Hackathon/Hack/Jam — "Superlinked × Qwen Hackathon",
#: "GDG Hackathon", "ICHack 2026".
_HACKATHON_NAME = re.compile(
    r"\b((?:[A-Z][\w''.\-]*|×|&)(?:\s+(?:[A-Z][\w''.\-]*|×|&|of|the|for)){0,5}\s*"
    r"(?:Hackathon|Hacks|Hack|Jam|Challenge))\b"
)
_SINGLE_WORD_HACK = re.compile(r"\b([A-Z][A-Za-z]*(?:Hacks?|Jam)\b)")

_YEAR = re.compile(r"\b(20[0-3]\d)\b")

_STOPWORDS = {"the", "a", "an", "at", "of", "for", "in", "on"}


@dataclass(frozen=True)
class Claim:
    placement: str
    hackathon_name: str | None
    year: int | None
    prize: str | None
    #: 0.0–1.0. Explicit placements beat a bare "winner", which beats a bare trophy emoji.
    confidence: float


def _hackathon_name(text: str) -> str | None:
    for match in _HACKATHON_NAME.finditer(text):
        name = " ".join(w for w in match.group(1).split() if w.lower() not in _STOPWORDS)
        if name and not name.lower().startswith(("best ", "most ")):
            return name.strip(" -–—:")
    match = _SINGLE_WORD_HACK.search(text)
    return match.group(1) if match else None


def _named_prize(text: str) -> str | None:
    match = _NAMED_PRIZE.search(text)
    if not match:
        return None
    prize = match.group(1).strip(" \"'”-–—")
    # "Best Hardware Hack" is a prize; "Best" alone is not.
    return prize if len(prize.split()) >= 2 else None


def extract_claim(text: str | None) -> Claim | None:
    """Return a Claim if `text` credibly claims a hackathon win, else None."""
    if not text or not text.strip():
        return None

    strong_context = bool(_STRONG_CONTEXT.search(text))
    if not strong_context and not _WEAK_CONTEXT.search(text):
        return None

    if _PARTICIPATION_ONLY.search(text):
        return None

    placement = None
    for pattern, label in _PLACEMENTS:
        if pattern.search(text):
            placement = label
            break
    if placement is None:
        return None

    # A bare "won" is weak on its own — "we won some swag", "won't". Require corroboration.
    explicit = placement not in {"won", "winner"}

    # "Challenge" alone is too common to trust without an explicit placement.
    if not strong_context and not explicit:
        return None
    trophy = bool(_TROPHY.search(text))
    prize = _named_prize(text)

    if placement == "won" and not (trophy or prize):
        return None

    confidence = 0.6
    if explicit:
        confidence += 0.2
    if trophy:
        confidence += 0.1
    if prize:
        confidence += 0.1

    year_match = _YEAR.search(text)
    return Claim(
        placement=placement,
        hackathon_name=_hackathon_name(text),
        year=int(year_match.group(1)) if year_match else None,
        prize=prize,
        confidence=min(confidence, 1.0),
    )
