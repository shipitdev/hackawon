"""Tests for hackathon slugs — the public URL identity."""
import pytest
from app.jobs.export_site import make_slug


class TestSlug:
    def test_readable_from_the_title(self):
        assert make_slug("HackSpire'26", "9f3e3e2ea4194c71").startswith("hackspire-26-")

    def test_ends_with_a_stable_id_fragment(self):
        """Two hackathons can share a name; the id fragment keeps URLs unique."""
        a = make_slug("HackTU", "aaaaaaaaaaaa")
        b = make_slug("HackTU", "bbbbbbbbbbbb")
        assert a != b

    def test_is_url_safe(self):
        slug = make_slug("AI/ML & Web3: Build — Fast!", "abc12345")
        assert slug.replace("-", "").isalnum()
        assert slug == slug.lower()

    def test_handles_non_ascii_titles(self):
        slug = make_slug("हैकाथॉन 2026", "abc12345")
        assert slug.endswith("abc12345")
        assert slug.replace("-", "").isalnum()

    def test_is_stable_for_the_same_input(self):
        """URLs must not churn between builds, or every shared link rots."""
        assert make_slug("Hack X", "abc12345") == make_slug("Hack X", "abc12345")

    def test_does_not_run_away_with_a_long_title(self):
        slug = make_slug("A " * 80, "abc12345")
        assert len(slug) <= 80

    def test_title_that_produces_nothing_still_yields_a_slug(self):
        assert make_slug("!!! ???", "abc12345") == "hackathon-abc12345"

    def test_does_not_stutter_when_the_id_is_already_the_title(self):
        """MLH ids are slugs, so naive joining produced 'hackrice-hackrice'."""
        assert make_slug("HackRice", "hackrice") == "hackrice"

    def test_does_not_stutter_when_the_title_ends_with_the_id(self):
        assert make_slug("Hack The North", "the-north") == "hack-the-north"

    def test_still_appends_when_the_id_adds_information(self):
        assert make_slug("HackRice", "14416") == "hackrice-14416"
