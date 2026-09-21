"""Whether a listing is still actionable for a student."""

from __future__ import annotations

from datetime import UTC, datetime

from app.models import HackathonRecord


def is_open_for_registration(record: HackathonRecord, now: datetime | None = None) -> bool:
    """Keep undated listings, but remove a listing as soon as its known cutoff passes."""
    now = now or datetime.now(UTC)
    cutoff = record.reg_deadline or record.starts_at or record.ends_at
    if cutoff is None:
        return True
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=UTC)
    return cutoff > now
