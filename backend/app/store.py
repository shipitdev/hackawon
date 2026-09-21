"""The durable store: plain JSON files in the repo.

Why files and not a database: git gives us history and diffs for free, community submissions arrive
as reviewable pull requests, and there is nothing to host. SQLite is only ever a derived working
copy. One file per record keeps diffs small and merge conflicts rare.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app.models import HackathonRecord, ProjectRecord

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


def prune_hackathon_artifacts(
    records: list[HackathonRecord], data_dir: Path | None = None
) -> dict[str, int]:
    """Remove expired listings and the generated files that are meaningful only for them."""
    root = data_dir or DATA_DIR
    removed: dict[str, int] = {}
    uids = {record.uid for record in records}
    for record in records:
        path = _path_for(record, root)
        if path.exists():
            path.unlink()
            removed[record.source] = removed.get(record.source, 0) + 1
        idea = root / "ideas" / f"{record.uid.replace(':', '_')}.json"
        if idea.exists():
            idea.unlink()

    labels_path = root / "labels" / "hackathons.json"
    if labels_path.exists() and uids:
        labels = json.loads(labels_path.read_text(encoding="utf-8"))
        remaining = {uid: value for uid, value in labels.items() if uid not in uids}
        if len(remaining) != len(labels):
            labels_path.write_text(
                json.dumps(remaining, indent=2, sort_keys=True, ensure_ascii=False),
                encoding="utf-8",
            )
    return removed


def write_source_runs(
    runs: list[dict], data_dir: Path | None = None, expired_removed: dict[str, int] | None = None
) -> Path:
    """Per-source outcome of the last ingest — drives the status page and the canary."""
    path = (data_dir or DATA_DIR) / "source_runs.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    expired_removed = expired_removed or {}
    payload = {
        "updated_at": datetime.now().astimezone().isoformat(),
        "runs": [
            {**run, "expired_removed": expired_removed.get(str(run["source"]), 0)} for run in runs
        ],
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return path


def write_project(record: ProjectRecord, data_dir: Path | None = None) -> bool:
    """Write a past project. Same change-detection contract as `write_hackathon`."""
    path = (data_dir or DATA_DIR) / "winners" / record.source / f"{record.source_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(
        record.model_dump(mode="json"), indent=2, sort_keys=True, ensure_ascii=False
    )
    if path.exists() and path.read_text(encoding="utf-8") == payload:
        return False
    path.write_text(payload, encoding="utf-8")
    return True


def read_projects(data_dir: Path | None = None) -> list[ProjectRecord]:
    root = (data_dir or DATA_DIR) / "winners"
    if not root.exists():
        return []
    return [
        ProjectRecord.model_validate_json(p.read_text(encoding="utf-8"))
        for p in sorted(root.glob("*/*.json"))
    ]
