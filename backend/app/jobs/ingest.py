"""Ingest job: fetch every source, drop stale events, dedupe, write JSON.

Run by GitHub Actions on a schedule. Design rules:
  * One broken source must never stop the others — each is isolated and its failure recorded.
  * Filtering is date-based. Unstop's `status` field says LIVE for events that ended months ago.
  * Exit code is non-zero only if *every* source failed, so a single site redesign doesn't
    turn the whole pipeline red.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta, timezone

from app.models import HackathonRecord
from app.sources import devfolio, mlh, unstop
from app.store import write_hackathon, write_source_runs

SOURCES = (devfolio, unstop, mlh)

#: Keep recently-finished events briefly — they're still useful context and dates are often wrong.
GRACE = timedelta(days=7)

_NOISE = re.compile(r"[^a-z0-9]+")


def _normalise_title(title: str) -> str:
    """'HackTU 3.0' and 'hacktu 3.0' are the same event; edition numbers are meaningful, so kept."""
    return _NOISE.sub(" ", title.lower()).strip()


def _last_date(record: HackathonRecord) -> datetime | None:
    return record.ends_at or record.reg_deadline or record.starts_at


def is_current(record: HackathonRecord, now: datetime | None = None) -> bool:
    """Undated events are kept: better a stale listing than silently dropping a real hackathon."""
    now = now or datetime.now(timezone.utc)
    last = _last_date(record)
    if last is None:
        return True
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return last >= now - GRACE


def dedupe(records: list[HackathonRecord]) -> list[HackathonRecord]:
    """Collapse the same event cross-listed on several sites.

    Keyed on normalised title + start date. The first source wins, which makes SOURCES order a
    deliberate preference: Devfolio's data is richer than MLH's for the same event.
    """
    seen: dict[tuple[str, str], HackathonRecord] = {}
    out: list[HackathonRecord] = []
    for record in records:
        day = record.starts_at.date().isoformat() if record.starts_at else ""
        key = (_normalise_title(record.title), day)
        if key in seen and day:
            continue
        seen[key] = record
        out.append(record)
    return out


def run(dry_run: bool = False) -> int:
    collected: list[HackathonRecord] = []
    runs: list[dict] = []

    for module in SOURCES:
        try:
            fetched = module.fetch()
            current = [r for r in fetched if is_current(r)]
            collected.extend(current)
            runs.append(
                {"source": module.NAME, "ok": True, "fetched": len(fetched),
                 "current": len(current), "error": None}
            )
            print(f"  {module.NAME}: {len(fetched)} fetched, {len(current)} current")
        except Exception as exc:  # one site's redesign must not stop the rest
            runs.append(
                {"source": module.NAME, "ok": False, "fetched": 0, "current": 0,
                 "error": f"{type(exc).__name__}: {exc}"[:300]}
            )
            print(f"  {module.NAME}: FAILED {type(exc).__name__}: {exc}", file=sys.stderr)

    unique = dedupe(collected)
    print(f"\n  {len(collected)} current records -> {len(unique)} after dedupe")

    if dry_run:
        print("  (dry run: nothing written)")
        return 0 if any(r["ok"] for r in runs) else 1

    changed = sum(write_hackathon(record) for record in unique)
    write_source_runs(runs)
    print(f"  wrote {len(unique)} files ({changed} changed)")

    return 0 if any(r["ok"] for r in runs) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="fetch and report, write nothing")
    args = parser.parse_args()
    return run(dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
