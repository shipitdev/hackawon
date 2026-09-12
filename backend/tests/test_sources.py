"""Adapter tests run against saved fixtures, so they never touch the live sites.

Each source's `parse` is a pure function over a captured payload. Fetching is separate and
untested here on purpose — what breaks in practice is the parsing, when a site redesigns.
"""

import json
from pathlib import Path

import pytest

from app.sources import devfolio, mlh, unstop

FIXTURES = Path(__file__).parent / "fixtures"


def load_json(rel: str):
    return json.loads((FIXTURES / rel).read_text())


class TestDevfolio:
    @pytest.fixture
    def records(self):
        return devfolio.parse(load_json("devfolio/hackathons_open.json"))

    def test_parses_every_hit(self, records):
        assert len(records) == 3

    def test_core_fields(self, records):
        r = next(r for r in records if r.title == "HackSpire'26")
        assert r.source == "devfolio"
        assert r.source_id == "9f3e3e2ea4194c7195b519b6808c4779"
        assert r.url == "https://hackspire26.devfolio.co/"
        assert r.city == "Kolkata"
        assert r.country == "India"
        assert r.mode == "in_person"
        assert r.starts_at is not None and r.starts_at.year == 2026
        assert r.ends_at is not None and r.ends_at > r.starts_at

    def test_sponsors_and_tracks(self, records):
        """Sponsor prizes are the track data that makes generated ideas specific."""
        r = next(r for r in records if r.title == "HackSpire'26")
        assert "ElevenLabs" in r.sponsors
        assert any("Grand Prize" in t for t in r.tracks)

    def test_uid_is_stable_and_namespaced(self, records):
        assert records[0].uid == f"devfolio:{records[0].source_id}"


class TestUnstop:
    @pytest.fixture
    def records(self):
        return unstop.parse(load_json("unstop/hackathons.json"))

    def test_parses_every_row(self, records):
        assert len(records) == 5

    def test_core_fields(self, records):
        r = next(r for r in records if r.title == "HackCelestial 3.0")
        assert r.source == "unstop"
        assert r.source_id == "1737808"
        assert r.url.startswith("https://unstop.com/hackathons/")
        assert r.mode == "in_person"
        assert r.organiser == "Pillai University, Navi Mumbai"

    def test_prize_and_team_size(self, records):
        r = next(r for r in records if r.title == "HackCelestial 3.0")
        assert r.prize_amount == 150000
        assert r.prize_currency == "INR"
        assert r.team_max == 5

    def test_registration_deadline(self, records):
        r = next(r for r in records if r.title == "HackCelestial 3.0")
        assert r.reg_deadline is not None
        assert r.reg_deadline.year == 2026


class TestMLH:
    @pytest.fixture
    def records(self):
        return mlh.parse((FIXTURES / "mlh/events_snippet.html").read_text(), season=2027)

    def test_parses_events_from_microdata(self, records):
        # The fixture is trimmed to 3 event cards; the last may be cut off mid-card.
        assert len(records) >= 2

    def test_core_fields(self, records):
        r = records[0]
        assert r.source == "mlh"
        assert r.title
        assert r.url.startswith("http")
        assert r.starts_at is not None
        assert r.mode in {"in_person", "online", "hybrid", "unknown"}

    def test_location_is_parsed(self, records):
        assert any(r.city and r.country for r in records)


class TestNormalisation:
    """Cross-source guarantees the ingest job depends on."""

    def test_all_sources_produce_the_same_shape(self):
        batches = [
            devfolio.parse(load_json("devfolio/hackathons_open.json")),
            unstop.parse(load_json("unstop/hackathons.json")),
            mlh.parse((FIXTURES / "mlh/events_snippet.html").read_text(), season=2027),
        ]
        for records in batches:
            assert records, "every source must yield at least one record"
            for r in records:
                assert r.source and r.source_id and r.title and r.url
                assert r.uid == f"{r.source}:{r.source_id}"
                assert isinstance(r.themes, list) and isinstance(r.tracks, list)

    def test_raw_payload_is_retained(self):
        """Keeping raw means a parser fix can be re-run without re-scraping."""
        records = devfolio.parse(load_json("devfolio/hackathons_open.json"))
        assert records[0].raw
