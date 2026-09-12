"""Bundle the file store into what the static site actually fetches.

The site is a newspaper: no server, no API. This job prints one bundle the browser downloads and
filters client-side. A few hundred records is small enough that this beats pagination.

It is also the escape hatch named in the design: whatever happens to hosting later, this bundle
keeps the site working.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import yaml

from app.models import HackathonRecord
from app.store import DATA_DIR, read_hackathons, read_projects
from app.tools import load_tools
from app.tools import to_web as tools_to_web

OUTPUT_DIR = Path(__file__).resolve().parents[3] / "frontend" / "public" / "data"

#: `raw` is kept on disk for replaying parser fixes, but it would bloat the download.
DROP_FOR_WEB = {"raw", "description"}


def to_web(record: HackathonRecord) -> dict:
    data = record.model_dump(mode="json", exclude=DROP_FOR_WEB)
    data["uid"] = record.uid
    # Truncated so the bundle stays small; the full text is a click away on the source site.
    if record.description:
        text = " ".join(record.description.split())
        data["excerpt"] = text[:280] + ("…" if len(text) > 280 else "")
    return data


_SLUG_STRIP = re.compile(r"[^a-z0-9]+")

#: Keep URLs readable but bounded; the id fragment guarantees uniqueness.
SLUG_TITLE_CHARS = 60
SLUG_ID_CHARS = 8


def make_slug(title: str, source_id: str) -> str:
    """A hackathon's public URL identity: readable title plus a fragment of its source id.

    Derived only from fields that do not drift, because a changed slug breaks every link anyone
    has shared. Titles are not unique (annual events repeat, and two sites use the same name), so
    the id fragment does the disambiguating.
    """
    ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    words = _SLUG_STRIP.sub("-", ascii_title.lower()).strip("-")[:SLUG_TITLE_CHARS].strip("-")
    words = words or "hackathon"

    clean_id = _SLUG_STRIP.sub("-", source_id.lower()).strip("-")
    # Two kinds of id in the wild: opaque (Devfolio's 32-char uuids, Unstop's numbers) and
    # already-readable (MLH uses slugs like "hack-the-north"). Truncating the readable kind turned
    # "the-north" into "the-nort" and broke the stutter check below, so only shorten opaque ids.
    opaque = "-" not in clean_id and len(clean_id) > SLUG_ID_CHARS
    fragment = clean_id[:SLUG_ID_CHARS] if opaque else clean_id

    # MLH ids are themselves slugs, so joining naively produced "hackrice-hackrice".
    if words == fragment or words.endswith(f"-{fragment}"):
        return words
    return f"{words}-{fragment}"


def _labels(kind: str, data_dir: Path | None) -> dict:
    path = (data_dir or DATA_DIR) / "labels" / f"{kind}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _ideas(data_dir: Path | None) -> dict[str, dict]:
    """uid -> the stored ideas record, keyed back to the hackathon it belongs to."""
    root = (data_dir or DATA_DIR) / "ideas"
    if not root.exists():
        return {}
    out = {}
    for path in root.glob("*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if record.get("hackathon_uid"):
            out[record["hackathon_uid"]] = record
    return out


def _domain_labels(data_dir: Path | None) -> dict[str, str]:
    path = (data_dir or DATA_DIR) / "taxonomy.yml"
    if not path.exists():
        return {}
    tax = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {d["id"]: d["label"] for d in tax.get("domains", [])}


def build(data_dir: Path | None = None) -> dict:
    records = read_hackathons(data_dir or DATA_DIR)
    labels = _labels("hackathons", data_dir)
    ideas = _ideas(data_dir)
    domain_labels = _domain_labels(data_dir)
    # Sort by whatever date the student actually acts on: the event if we know it, else the
    # registration deadline. Unstop publishes no event start for most listings.
    far_future = datetime.max.replace(tzinfo=UTC)

    def when(r: HackathonRecord) -> datetime:
        chosen = r.starts_at or r.reg_deadline
        if chosen is None:
            return far_future
        return chosen if chosen.tzinfo else chosen.replace(tzinfo=UTC)

    records.sort(key=when)

    rows = []
    for record in records:
        row = to_web(record)
        # Unlabelled hackathons still appear; they just won't match a category filter.
        row["domains"] = labels.get(record.uid, {}).get("domains", [])
        # Denormalise the human label so search can match "machine learning", not just "ai-ml".
        # Roughly 20 bytes per record, and it fixed search returning 2 of 13 fintech events.
        row["topic_labels"] = [domain_labels[d] for d in row["domains"] if d in domain_labels]

        # Only the COUNT goes in the index. Ideas and exemplars were 79% of the payload
        # (988 KB of 1.25 MB) and nobody needs them until they open a card, so each hackathon
        # gets its own file fetched on demand.
        stored = ideas.get(record.uid)
        row["idea_count"] = len(stored["ideas"]) if stored else 0
        # One idea title as a teaser. The full set is ~988 KB and stays out of the index, but the
        # ideas are the most interesting thing here and were invisible until someone clicked.
        row["idea_teaser"] = stored["ideas"][0]["title"] if stored and stored["ideas"] else None
        # The public URL. Stored on the record so the frontend, the prerenderer and the sitemap
        # cannot disagree about where a hackathon lives.
        row["slug"] = make_slug(record.title, record.source_id)
        rows.append(row)

    taxonomy_path = (data_dir or DATA_DIR) / "taxonomy.yml"
    domains = []
    if taxonomy_path.exists():
        tax = yaml.safe_load(taxonomy_path.read_text(encoding="utf-8"))
        counts = Counter(d for row in rows for d in row["domains"])
        # Ship labels and counts with the data so the UI needs no hardcoded copy of the taxonomy.
        domains = [
            {"id": d["id"], "label": d["label"], "count": counts.get(d["id"], 0)}
            for d in tax["domains"]
            if counts.get(d["id"], 0) > 0
        ]
        domains.sort(key=lambda d: -d["count"])

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "count": len(records),
        "domains": domains,
        "hackathons": rows,
    }


def write_idea_files(data_dir: Path | None, out: Path) -> int:
    """One file per hackathon: its ideas plus just the exemplars those ideas actually cite."""
    ideas = _ideas(data_dir)
    if not ideas:
        return 0
    projects = {p.uid: p for p in read_projects(data_dir or DATA_DIR)}
    target = out / "ideas"
    target.mkdir(parents=True, exist_ok=True)

    for uid, stored in ideas.items():
        cited = {i for idea in stored["ideas"] for i in idea.get("inspired_by", [])}
        payload = {
            "ideas": stored["ideas"],
            "grounding": stored.get("grounding", {}),
            "exemplars": [
                {
                    "uid": p.uid,
                    "title": p.title,
                    "url": p.url,
                    "prize": p.prize,
                    "hackathon_name": p.hackathon_name,
                    "year": p.year,
                    "tech": p.tech[:4],
                }
                for uid_ref in cited
                if (p := projects.get(uid_ref)) is not None
            ],
        }
        (target / f"{uid.replace(':', '_')}.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
    return len(ideas)


def run(data_dir: Path | None = None, output_dir: Path | None = None) -> Path:
    bundle = build(data_dir)
    out = output_dir or OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    path = out / "hackathons.json"
    path.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")

    written = write_idea_files(data_dir, out)
    if written:
        print(f"  wrote {written} per-hackathon idea files")

    tools_path = (data_dir or DATA_DIR) / "tools.yml"
    if tools_path.exists():
        payload = tools_to_web(load_tools(tools_path))
        (out / "tools.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
        print(f"  wrote tools.json — {payload['count']} tools")

    runs = (data_dir or DATA_DIR) / "source_runs.json"
    if runs.exists():
        (out / "source_runs.json").write_text(runs.read_text(encoding="utf-8"), encoding="utf-8")

    size_kb = path.stat().st_size / 1024
    print(f"  wrote {path} — {bundle['count']} hackathons, {size_kb:.0f} KB")
    return path


if __name__ == "__main__":
    run()
