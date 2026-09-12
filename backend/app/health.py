"""Detect a source that still works but has quietly stopped returning data.

The canary catches scrapers that raise. It cannot catch the more likely failure: a site changes a
parameter, the request still returns 200, and the scraper faithfully reports 5 hackathons instead
of 155. Every job succeeds, the site empties out, and nobody is told.

This compares each run against the median of recent runs. Median rather than mean because one bad
run should not move the baseline much, and a run that failed outright is not recorded at all —
storing it as zero would drag the baseline down and hide the next real drop.
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import median

from app.store import DATA_DIR

HEALTH_PATH = DATA_DIR / "source_health.json"

#: How many past runs form the baseline.
BASELINE_RUNS = 12

#: Flag a run below this fraction of the recent median.
DROP_RATIO = 0.5

#: Sources this small vary too much for a ratio to mean anything.
MIN_MEANINGFUL = 5


def load_history(path: Path | None = None) -> dict[str, list[int]]:
    target = path or HEALTH_PATH
    if not target.exists():
        return {}
    return json.loads(target.read_text(encoding="utf-8")).get("counts", {})


def save_history(history: dict[str, list[int]], path: Path | None = None) -> Path:
    target = path or HEALTH_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"counts": history}, indent=2, sort_keys=True), encoding="utf-8")
    return target


def record_counts(
    history: dict[str, list[int]], counts: dict[str, int | None]
) -> dict[str, list[int]]:
    """Prepend this run's counts, newest first. `None` means the source failed; skip it."""
    updated = {source: list(runs) for source, runs in history.items()}
    for source, count in counts.items():
        if count is None:
            continue
        updated.setdefault(source, []).insert(0, int(count))
        del updated[source][BASELINE_RUNS:]
    return updated


def check_counts(history: dict[str, list[int]], counts: dict[str, int | None]) -> list[str]:
    """Human-readable problems with this run. Empty list means everything looks normal."""
    problems: list[str] = []

    for source, runs in sorted(history.items()):
        if not runs:
            continue

        if source not in counts:
            problems.append(
                f"{source}: absent from this run, but previously returned "
                f"~{int(median(runs))} records"
            )
            continue

        current = counts[source]
        if current is None:
            continue

        baseline = median(runs)
        if baseline < MIN_MEANINGFUL:
            continue

        floor = baseline * DROP_RATIO
        if current < floor:
            problems.append(
                f"{source}: returned {current}, expected at least {int(floor)} "
                f"(recent median {int(baseline)})"
            )

    return problems
