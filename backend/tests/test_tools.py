"""Validation for the curated toolkit.

This file is edited by hand and by contributors, so the tests exist to catch the mistakes a human
makes in YAML: a typo'd category, a missing date, a URL that is not a URL. A wrong entry here
sends a student to a dead link mid-hackathon, which is worse than having no entry at all.
"""

from datetime import date

import pytest

from app.tools import CATEGORIES, load_tools


@pytest.fixture(scope="module")
def tools():
    return load_tools()


class TestToolsFile:
    def test_it_loads_and_is_not_empty(self, tools):
        assert len(tools) >= 10

    def test_every_entry_has_the_required_fields(self, tools):
        for tool in tools:
            assert tool.name, "a tool needs a name"
            assert tool.url.startswith("https://"), f"{tool.name}: url must be https"
            assert tool.what_you_get, f"{tool.name}: say what you actually get"
            assert tool.checked, f"{tool.name}: needs a checked date"

    def test_categories_are_from_the_known_set(self, tools):
        for tool in tools:
            assert tool.category in CATEGORIES, f"{tool.name}: unknown category {tool.category!r}"

    def test_names_are_unique(self, tools):
        names = [t.name for t in tools]
        assert len(names) == len(set(names))

    def test_checked_dates_are_not_in_the_future(self, tools):
        for tool in tools:
            assert tool.checked <= date.today(), f"{tool.name}: checked date is in the future"

    def test_what_you_get_is_specific_not_marketing(self, tools):
        """"Generous free tier" helps nobody. Reject the words that mean nothing."""
        banned = ("generous", "amazing", "best-in-class", "powerful")
        for tool in tools:
            lowered = tool.what_you_get.lower()
            for word in banned:
                assert word not in lowered, f"{tool.name}: '{word}' says nothing useful"

    def test_every_category_in_use_has_at_least_one_entry(self, tools):
        used = {t.category for t in tools}
        assert used, "no categories in use"
        assert used <= set(CATEGORIES)


class TestStaleness:
    def test_staleness_is_computed_from_the_checked_date(self):
        from app.tools import is_stale

        assert is_stale(date(2020, 1, 1), today=date(2026, 9, 12)) is True
        assert is_stale(date(2026, 9, 1), today=date(2026, 9, 12)) is False

    def test_the_boundary_is_ninety_days(self):
        from app.tools import STALE_AFTER_DAYS, is_stale

        today = date(2026, 9, 12)
        fresh = date(2026, 9, 12 - 1)
        assert STALE_AFTER_DAYS == 90
        assert is_stale(fresh, today=today) is False


class TestHonesty:
    def test_a_tool_marked_not_free_says_so(self, tools):
        """xAI is listed precisely because the internet still calls it free. Keep that honest."""
        paid = [t for t in tools if not t.free]
        for tool in paid:
            assert tool.caveat, f"{tool.name}: if it is not free, explain what people assume wrong"
