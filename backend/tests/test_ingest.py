"""Tests for the parts of ingest that silently corrupt the dataset when wrong."""

from datetime import datetime, timedelta, timezone

import pytest

from app.jobs.ingest import dedupe, is_current
from app.models import HackathonRecord
from app.store import read_hackathons, write_hackathon

NOW = datetime(2026, 9, 12, tzinfo=timezone.utc)


def make(title="Hack X", source="devfolio", source_id="1", **kw) -> HackathonRecord:
    return HackathonRecord(
        source=source, source_id=source_id, title=title, url="https://example.com/", **kw
    )


class TestIsCurrent:
    def test_future_event_is_kept(self):
        assert is_current(make(ends_at=NOW + timedelta(days=30)), now=NOW)

    def test_long_past_event_is_dropped(self):
        assert not is_current(make(ends_at=NOW - timedelta(days=200)), now=NOW)

    def test_just_finished_event_is_kept(self):
        """Dates from these sites are often a day or two off; a grace window absorbs that."""
        assert is_current(make(ends_at=NOW - timedelta(days=2)), now=NOW)

    def test_undated_event_is_kept(self):
        """Dropping a real hackathon is worse than showing one with an unknown date."""
        assert is_current(make(), now=NOW)

    def test_naive_datetime_does_not_crash(self):
        """Sources mix aware and naive timestamps; comparing them raises unless handled."""
        assert is_current(make(ends_at=datetime(2026, 12, 1)), now=NOW)

    def test_falls_back_to_registration_deadline(self):
        assert is_current(make(reg_deadline=NOW + timedelta(days=5)), now=NOW)


class TestDedupe:
    def test_same_event_from_two_sources_collapses(self):
        start = NOW + timedelta(days=10)
        records = [
            make(title="HackTU 3.0", source="devfolio", starts_at=start),
            make(title="hacktu 3.0", source="mlh", source_id="9", starts_at=start),
        ]
        assert len(dedupe(records)) == 1

    def test_first_source_wins(self):
        start = NOW + timedelta(days=10)
        records = [
            make(title="HackTU", source="devfolio", starts_at=start),
            make(title="HackTU", source="mlh", source_id="9", starts_at=start),
        ]
        assert dedupe(records)[0].source == "devfolio"

    def test_same_name_different_year_is_kept(self):
        """Annual events repeat their name — collapsing editions would lose real hackathons."""
        records = [
            make(title="HackTU", source_id="1", starts_at=NOW + timedelta(days=10)),
            make(title="HackTU", source_id="2", starts_at=NOW + timedelta(days=375)),
        ]
        assert len(dedupe(records)) == 2

    def test_undated_records_are_never_collapsed(self):
        records = [make(title="Hack", source_id="1"), make(title="Hack", source_id="2")]
        assert len(dedupe(records)) == 2


class TestStore:
    def test_round_trip(self, tmp_path):
        record = make(title="Hack Me", starts_at=NOW, tracks=["Best AI Hack"])
        assert write_hackathon(record, data_dir=tmp_path) is True
        loaded = read_hackathons(data_dir=tmp_path)
        assert len(loaded) == 1
        assert loaded[0].title == "Hack Me"
        assert loaded[0].tracks == ["Best AI Hack"]

    def test_unchanged_record_reports_no_change(self, tmp_path):
        """The cron commits only real changes, so an unchanged run must produce an empty diff."""
        record = make(starts_at=NOW)
        write_hackathon(record, data_dir=tmp_path)
        assert write_hackathon(record, data_dir=tmp_path) is False

    def test_changed_record_is_rewritten(self, tmp_path):
        write_hackathon(make(starts_at=NOW), data_dir=tmp_path)
        assert write_hackathon(make(title="Renamed", starts_at=NOW), data_dir=tmp_path) is True

    def test_empty_store_reads_cleanly(self, tmp_path):
        assert read_hackathons(data_dir=tmp_path) == []


@pytest.mark.parametrize("source", ["devfolio", "unstop", "mlh"])
def test_every_source_module_exposes_the_contract(source):
    module = __import__(f"app.sources.{source}", fromlist=["NAME"])
    assert isinstance(module.NAME, str)
    assert callable(module.parse) and callable(module.fetch)
