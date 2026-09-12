"""Collect past hackathon-winning projects.

Runs less often than the hackathon ingest — the winners corpus grows slowly and old entries never
expire. Community submissions in `data/winners/community/` are hand-written YAML and are never
touched by this job.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

from app.store import write_project
from app.winners import github

SOURCES = (github,)


def run(dry_run: bool = False) -> int:
    collected = []
    ok = False

    for module in SOURCES:
        try:
            projects = module.fetch()
            collected.extend(projects)
            ok = True
            print(f"  {module.NAME}: {len(projects)} verified winners")
        except Exception as exc:
            print(f"  {module.NAME}: FAILED {type(exc).__name__}: {exc}", file=sys.stderr)

    if collected:
        by_year = Counter(p.year for p in collected if p.year)
        placements = Counter(p.raw.get("placement") for p in collected)
        print(f"  years: {dict(sorted(by_year.items(), reverse=True)[:6])}")
        print(f"  placements: {dict(placements.most_common(5))}")
        named = sum(1 for p in collected if p.hackathon_name)
        print(f"  with a named hackathon: {named}/{len(collected)}")

    if dry_run:
        print("  (dry run: nothing written)")
        return 0 if ok else 1

    changed = sum(write_project(p) for p in collected)
    print(f"  wrote {len(collected)} winners ({changed} changed)")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="fetch and report, write nothing")
    args = parser.parse_args()
    return run(dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
