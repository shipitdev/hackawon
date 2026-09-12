"""Bundle the file store into what the static site actually fetches.

The site is a newspaper: no server, no API. This job prints one bundle the browser downloads and
filters client-side. A few hundred records is small enough that this beats pagination.

It is also the escape hatch named in the design: whatever happens to hosting later, this bundle
keeps the site working.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.models import HackathonRecord
from app.store import DATA_DIR, read_hackathons

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


def build(data_dir: Path | None = None) -> dict:
    records = read_hackathons(data_dir or DATA_DIR)
    # Sort by whatever date the student actually acts on: the event if we know it, else the
    # registration deadline. Unstop publishes no event start for most listings.
    far_future = datetime.max.replace(tzinfo=UTC)

    def when(r: HackathonRecord) -> datetime:
        chosen = r.starts_at or r.reg_deadline
        if chosen is None:
            return far_future
        return chosen if chosen.tzinfo else chosen.replace(tzinfo=UTC)

    records.sort(key=when)
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "count": len(records),
        "hackathons": [to_web(r) for r in records],
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
