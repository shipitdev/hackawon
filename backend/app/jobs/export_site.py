"""Bundle the file store into what the static site actually fetches.

The site is a newspaper: no server, no API. This job prints one bundle the browser downloads and
filters client-side. A few hundred records is small enough that this beats pagination.

It is also the escape hatch named in the design: whatever happens to hosting later, this bundle
keeps the site working.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import yaml

from app.models import HackathonRecord
from app.store import DATA_DIR, read_hackathons, read_projects

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


def build(data_dir: Path | None = None) -> dict:
    records = read_hackathons(data_dir or DATA_DIR)
    labels = _labels("hackathons", data_dir)
    ideas = _ideas(data_dir)
    projects = read_projects(data_dir or DATA_DIR) if ideas else []
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

        stored = ideas.get(record.uid)
        if stored:
            row["ideas"] = stored["ideas"]
            row["grounding"] = stored.get("grounding", {})
            # Exemplars are embedded per hackathon rather than shipped as one winners index:
            # only a handful are referenced, and this keeps the bundle small.
            referenced = {i for idea in stored["ideas"] for i in idea.get("inspired_by", [])}
            row["exemplars"] = [
                {
                    "uid": p.uid,
                    "title": p.title,
                    "url": p.url,
                    "prize": p.prize,
                    "hackathon_name": p.hackathon_name,
                    "year": p.year,
                    "tech": p.tech[:4],
                }
                for p in projects
                if p.uid in referenced
            ]
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


def run(data_dir: Path | None = None, output_dir: Path | None = None) -> Path:
    bundle = build(data_dir)
    out = output_dir or OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    path = out / "hackathons.json"
    path.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")

    runs = (data_dir or DATA_DIR) / "source_runs.json"
    if runs.exists():
        (out / "source_runs.json").write_text(runs.read_text(encoding="utf-8"), encoding="utf-8")

    size_kb = path.stat().st_size / 1024
    print(f"  wrote {path} — {bundle['count']} hackathons, {size_kb:.0f} KB")
    return path


if __name__ == "__main__":
    run()
