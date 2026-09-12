"""Generate and store ideas for upcoming hackathons.

Runs nightly. Ideas are written once per hackathon and served to everyone from a file, so LLM cost
scales with the number of hackathons (a few hundred a month), not with visitors. That is the whole
reason this app can be free.

Only hackathons that are still open get ideas — there is no point spending quota on an event
nobody can enter.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from app.ideas.generate import PROMPT_VERSION, generate_ideas
from app.ideas.llm import get_llm
from app.ideas.match import match_winners
from app.store import DATA_DIR, read_hackathons, read_projects
from app.taxonomy import load_taxonomy

IDEAS_DIR = DATA_DIR / "ideas"


def _labels(kind: str) -> dict:
    path = DATA_DIR / "labels" / f"{kind}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _already_done(uid: str, taxonomy_version: int) -> bool:
    path = IDEAS_DIR / f"{uid.replace(':', '_')}.json"
    if not path.exists():
        return False
    try:
        existing = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    # Regenerate when the prompt or taxonomy changed — the old ideas were built on different rules.
    return (
        existing.get("prompt_version") == PROMPT_VERSION
        and existing.get("taxonomy_version") == taxonomy_version
        and bool(existing.get("ideas"))
    )


def _write(record: dict) -> Path:
    IDEAS_DIR.mkdir(parents=True, exist_ok=True)
    path = IDEAS_DIR / f"{record['hackathon_uid'].replace(':', '_')}.json"
    path.write_text(
        json.dumps(record, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8"
    )
    return path


def run(limit: int | None, provider: str | None, force: bool) -> int:
    tax = load_taxonomy()
    llm = get_llm(provider)
    hackathon_labels = _labels("hackathons")
    project_labels = _labels("winners")
    projects = read_projects()
    now_year = datetime.now(UTC).year

    if not project_labels:
        print("  no labelled winners yet — run: python -m app.jobs.classify --kind winners")

    todo = []
    for h in read_hackathons():
        if not force and _already_done(h.uid, tax.version):
            continue
        todo.append(h)

    if limit:
        todo = todo[:limit]

    print(f"  {len(todo)} hackathons need ideas (provider: {llm.name}, {len(projects)} winners)")

    written = 0
    for index, h in enumerate(todo, 1):
        domains = (hackathon_labels.get(h.uid) or {}).get("domains") or ["general"]
        grounding = match_winners(h, domains, projects, project_labels, now_year)
        try:
            record = generate_ideas(h, grounding, tax, llm)
        except Exception as exc:
            print(f"    [{index}/{len(todo)}] {h.title[:40]}: FAILED {type(exc).__name__}: {exc}")
            continue

        if not record["ideas"]:
            print(f"    [{index}/{len(todo)}] {h.title[:40]}: no usable ideas returned")
            continue

        _write(record)
        written += 1
        flag = " (thin grounding)" if grounding.thin else ""
        print(f"    [{index}/{len(todo)}] {h.title[:40]}: {len(record['ideas'])} ideas{flag}")

    print(f"  wrote ideas for {written} hackathons")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="only process this many (useful for testing)")
    parser.add_argument("--provider", help="gemini or fake (default: $LLM_PROVIDER, else fake)")
    parser.add_argument("--force", action="store_true", help="regenerate even if ideas exist")
    args = parser.parse_args()
    try:
        return run(args.limit, args.provider, args.force)
    except Exception as exc:
        print(f"  FAILED {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
