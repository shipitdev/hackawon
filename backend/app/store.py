"""The durable store: plain JSON files in the repo.

Why files and not a database: git gives us history and diffs for free, community submissions arrive
as reviewable pull requests, and there is nothing to host. SQLite is only ever a derived working
copy. One file per record keeps diffs small and merge conflicts rare.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app.models import HackathonRecord

#: repo root -> data/
DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def _path_for(record: HackathonRecord, data_dir: Path) -> Path:
    return data_dir / "hackathons" / record.source / f"{record.source_id}.json"


def _serialise(record: HackathonRecord) -> str:
    # sort_keys keeps diffs stable when a source reorders its payload.
    return json.dumps(record.model_dump(mode="json"), indent=2, sort_keys=True, ensure_ascii=False)


def write_hackathon(record: HackathonRecord, data_dir: Path | None = None) -> bool:
    """Write a record. Returns True if the file changed, so callers can report real deltas."""
    path = _path_for(record, data_dir or DATA_DIR)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _serialise(record)
    if path.exists() and path.read_text(encoding="utf-8") == payload:
        return False
    path.write_text(payload, encoding="utf-8")
    return True


def read_hackathons(data_dir: Path | None = None) -> list[HackathonRecord]:
    root = (data_dir or DATA_DIR) / "hackathons"
    if not root.exists():
        return []
    records = []
    for path in sorted(root.glob("*/*.json")):
        records.append(HackathonRecord.model_validate_json(path.read_text(encoding="utf-8")))
    return records


def write_source_runs(runs: list[dict], data_dir: Path | None = None) -> Path:
    """Per-source outcome of the last ingest — drives the status page and the canary."""
    path = (data_dir or DATA_DIR) / "source_runs.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at": datetime.now().astimezone().isoformat(), "runs": runs}
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return path
