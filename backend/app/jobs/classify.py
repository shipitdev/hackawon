"""Label every hackathon and winning project against the taxonomy.

Costs nothing on a re-run: labels are cached by content hash, so only genuinely new or changed
items reach the model. Use `--force` to relabel everything after editing a prompt.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

from app.ideas.llm import get_llm
from app.store import read_hackathons, read_projects
from app.taxonomy import classify, hackathon_text, load_taxonomy, project_text


def _progress(done: int, total: int) -> None:
    print(f"    {done}/{total}", end="\r", flush=True)


def run(kinds: tuple[str, ...], provider: str | None, force: bool) -> int:
    tax = load_taxonomy()
    llm = get_llm(provider)
    print(f"  taxonomy v{tax.version}, provider: {llm.name}")

    if "hackathons" in kinds:
        records = read_hackathons()
        labels = classify(
            "hackathons",
            {r.uid: hackathon_text(r) for r in records},
            llm,
            tax,
            force,
            _progress,
        )
        counts = Counter(d for row in labels.values() for d in row.get("domains", []))
        print(f"\n  labelled {len(labels)}/{len(records)} hackathons")
        for domain, count in counts.most_common():
            print(f"    {domain:<16} {count}")

    if "winners" in kinds:
        projects = read_projects()
        labels = classify(
            "winners",
            {p.uid: project_text(p) for p in projects},
            llm,
            tax,
            force,
            _progress,
        )
        domains = Counter(d for row in labels.values() for d in row.get("domains", []))
        patterns = Counter(p for row in labels.values() for p in row.get("winning_patterns", []))
        shapes = Counter(row.get("archetype") for row in labels.values())
        print(f"\n  labelled {len(labels)}/{len(projects)} winners")
        print(f"    top domains:  {dict(domains.most_common(6))}")
        print(f"    top shapes:   {dict(shapes.most_common(4))}")
        print(f"    why they won: {dict(patterns.most_common(6))}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kind",
        choices=["hackathons", "winners", "all"],
        default="all",
        help="what to label (default: all)",
    )
    parser.add_argument("--provider", help="gemini or fake (default: $LLM_PROVIDER, else fake)")
    parser.add_argument("--force", action="store_true", help="relabel even if cached")
    args = parser.parse_args()

    kinds = ("hackathons", "winners") if args.kind == "all" else (args.kind,)
    try:
        return run(kinds, args.provider, args.force)
    except Exception as exc:
        print(f"  FAILED {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
