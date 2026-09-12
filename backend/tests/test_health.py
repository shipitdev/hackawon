"""Tests for source health checks.

The canary already catches a scraper that *errors*. It cannot catch the likelier failure: a source
that still returns 200 but far less data — Unstop silently dropping `oppstatus=open` support would
take the listings from 155 to about 5 while every job reported success. The site would quietly
empty out and nobody would be told.
"""

from app.health import BASELINE_RUNS, DROP_RATIO, check_counts, record_counts


class TestDropDetection:
    def test_a_collapse_is_reported(self):
        history = {"unstop": [155, 152, 158, 150, 156]}
        problems = check_counts(history, {"unstop": 5})
        assert len(problems) == 1
        assert "unstop" in problems[0]
        assert "5" in problems[0] and "15" in problems[0]  # current and expected floor

    def test_normal_variation_is_not_reported(self):
        history = {"unstop": [155, 152, 158, 150, 156]}
        assert check_counts(history, {"unstop": 141}) == []

    def test_growth_is_never_a_problem(self):
        history = {"unstop": [100, 102, 98]}
        assert check_counts(history, {"unstop": 400}) == []

    def test_zero_is_always_reported_when_there_was_history(self):
        assert check_counts({"mlh": [80, 79, 81]}, {"mlh": 0}) != []

    def test_a_brand_new_source_is_not_judged(self):
        """With no history there is no baseline, so anything is plausible."""
        assert check_counts({}, {"devfolio": 3}) == []

    def test_a_source_missing_from_this_run_is_reported(self):
        """Vanishing entirely is worse than shrinking, and must not pass silently."""
        problems = check_counts({"devfolio": [28, 27, 29]}, {"unstop": 155})
        assert any("devfolio" in p for p in problems)

    def test_each_source_is_judged_independently(self):
        history = {"unstop": [155, 150], "devfolio": [28, 27]}
        problems = check_counts(history, {"unstop": 152, "devfolio": 1})
        assert len(problems) == 1 and "devfolio" in problems[0]

    def test_a_small_source_is_not_flagged_for_tiny_wobbles(self):
        """Sources returning a handful of rows must not cry wolf on ±1."""
        assert check_counts({"tiny": [3, 2, 3]}, {"tiny": 2}) == []


class TestHistory:
    def test_records_the_latest_count(self):
        history = record_counts({}, {"unstop": 155})
        assert history["unstop"] == [155]

    def test_keeps_newest_first(self):
        history = record_counts({"unstop": [150]}, {"unstop": 155})
        assert history["unstop"][0] == 155

    def test_forgets_ancient_history(self):
        history = {"unstop": list(range(50))}
        assert len(record_counts(history, {"unstop": 1})["unstop"]) == BASELINE_RUNS

    def test_a_failed_source_is_not_recorded_as_zero(self):
        """Recording a failure as 0 would poison the baseline and hide the next real drop."""
        history = record_counts({"unstop": [155, 150]}, {"unstop": None})
        assert history["unstop"] == [155, 150]


def test_the_threshold_is_a_named_constant():
    assert 0 < DROP_RATIO < 1
