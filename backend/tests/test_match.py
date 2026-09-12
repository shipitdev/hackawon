"""Tests for exemplar matching.

The failure that matters here is silent and corrosive: confidently showing irrelevant winners, or
claiming solid grounding when the evidence is thin. Both make the generated advice worse than no
advice at all.
"""

from app.ideas.match import THIN_EVIDENCE, Grounding, match_winners, score
from app.models import HackathonRecord, ProjectRecord

NOW_YEAR = 2026


def hackathon(**kw) -> HackathonRecord:
    base = dict(source="devfolio", source_id="h1", title="AI Hack", url="https://x/")
    return HackathonRecord(**{**base, **kw})


def project(uid="1", year=2025, claim="description", confidence=0.8, **kw) -> ProjectRecord:
    base = dict(
        source="github",
        source_id=uid,
        title=f"Project {uid}",
        url=f"https://x/{uid}",
        evidence="winner",
        year=year,
        raw={"claim_source": claim, "confidence": confidence},
    )
    return ProjectRecord(**{**base, **kw})


def labels_for(*pairs) -> dict:
    """(project, domains, patterns) -> the labels dict the matcher expects."""
    out = {}
    for proj, domains, patterns in pairs:
        out[proj.uid] = {"domains": domains, "winning_patterns": patterns, "archetype": "web-app"}
    return out


class TestScoring:
    def test_shared_domain_beats_no_shared_domain(self):
        on_topic = project("a")
        off_topic = project("b")
        labels = labels_for((on_topic, ["ai-ml"], []), (off_topic, ["gaming"], []))
        a, _ = score(["ai-ml"], on_topic, labels["github:a"], NOW_YEAR)
        b, _ = score(["ai-ml"], off_topic, labels["github:b"], NOW_YEAR)
        assert a > b

    def test_prose_evidence_beats_a_topic_tag(self):
        strong = project("a", claim="description", confidence=0.9)
        weak = project("b", claim="topics", confidence=0.3)
        labels = labels_for((strong, ["ai-ml"], []), (weak, ["ai-ml"], []))
        a, _ = score(["ai-ml"], strong, labels["github:a"], NOW_YEAR)
        b, _ = score(["ai-ml"], weak, labels["github:b"], NOW_YEAR)
        assert a > b

    def test_recent_wins_outrank_old_ones(self):
        recent, old = project("a", year=2026), project("b", year=2019)
        labels = labels_for((recent, ["ai-ml"], []), (old, ["ai-ml"], []))
        a, _ = score(["ai-ml"], recent, labels["github:a"], NOW_YEAR)
        b, _ = score(["ai-ml"], old, labels["github:b"], NOW_YEAR)
        assert a > b

    def test_general_is_not_treated_as_a_shared_topic(self):
        """Everything is 'general'; counting it would make every match look on-topic."""
        p = project("a")
        labels = labels_for((p, ["general"], []))
        _, shared = score(["general"], p, labels["github:a"], NOW_YEAR)
        assert shared == []


class TestMatching:
    def test_prefers_on_topic_winners(self):
        ai = [
            project(
                f"ai{i}",
            )
            for i in range(6)
        ]
        game = [project(f"g{i}") for i in range(6)]
        labels = labels_for(
            *[(p, ["ai-ml"], ["working-demo"]) for p in ai], *[(p, ["gaming"], []) for p in game]
        )
        result = match_winners(hackathon(), ["ai-ml"], ai + game, labels, NOW_YEAR, limit=5)
        assert all("ai" in m.project.source_id for m in result.matches)
        assert result.thin is False

    def test_thin_evidence_is_flagged_not_hidden(self):
        """Claiming confident advice from two examples would be dishonest."""
        few = [project("a"), project("b")]
        labels = labels_for(*[(p, ["arvr"], []) for p in few])
        result = match_winners(hackathon(), ["arvr"], few, labels, NOW_YEAR)
        assert result.thin is True

    def test_falls_back_to_strong_winners_when_off_topic(self):
        """A themeless hackathon should still see examples rather than an empty page."""
        others = [project(str(i)) for i in range(6)]
        labels = labels_for(*[(p, ["fintech"], []) for p in others])
        result = match_winners(hackathon(), ["arvr"], others, labels, NOW_YEAR)
        assert len(result.matches) > 0
        assert result.thin is True
        assert all(m.shared_domains == [] for m in result.matches)

    def test_unlabelled_projects_are_skipped(self):
        result = match_winners(hackathon(), ["ai-ml"], [project("a")], {}, NOW_YEAR)
        assert result.matches == []

    def test_respects_the_limit(self):
        many = [project(str(i)) for i in range(30)]
        labels = labels_for(*[(p, ["ai-ml"], []) for p in many])
        result = match_winners(hackathon(), ["ai-ml"], many, labels, NOW_YEAR, limit=8)
        assert len(result.matches) == 8

    def test_summarises_why_those_projects_won(self):
        winners = [project(str(i)) for i in range(6)]
        labels = labels_for(*[(p, ["ai-ml"], ["sponsor-tech", "working-demo"]) for p in winners])
        result = match_winners(hackathon(), ["ai-ml"], winners, labels, NOW_YEAR)
        top = dict(result.patterns)
        assert top.get("sponsor-tech") == len(result.matches)

    def test_empty_corpus_is_not_an_error(self):
        result = match_winners(hackathon(), ["ai-ml"], [], {}, NOW_YEAR)
        assert isinstance(result, Grounding)
        assert result.matches == [] and result.thin is True


def test_thin_threshold_is_a_named_constant():
    """So the UI and the prompt agree on what 'thin' means."""
    assert THIN_EVIDENCE >= 3


class TestThemelessHackathons:
    """Most student hackathons set no theme. They are the common case, not an edge case."""

    def test_themeless_is_not_flagged_as_thin(self):
        """Warning on 70% of pages trains students to ignore the warning that matters."""
        winners = [project(str(i)) for i in range(20)]
        labels = labels_for(*[(p, ["ai-ml"], []) for p in winners])
        result = match_winners(hackathon(), ["general"], winners, labels, NOW_YEAR)
        assert result.thin is False
        assert len(result.matches) > 0

    def test_a_themed_hackathon_with_no_matches_is_still_flagged(self):
        winners = [project(str(i)) for i in range(20)]
        labels = labels_for(*[(p, ["gaming"], []) for p in winners])
        result = match_winners(hackathon(), ["arvr"], winners, labels, NOW_YEAR)
        assert result.thin is True

    def test_themeless_grounding_spans_several_domains(self):
        """AI dominates the corpus, so the naive top-8 would be eight AI projects."""
        ai = [project(f"ai{i}") for i in range(10)]
        fin = [project(f"fin{i}") for i in range(10)]
        civic = [project(f"civ{i}") for i in range(10)]
        labels = labels_for(
            *[(p, ["ai-ml"], []) for p in ai],
            *[(p, ["fintech"], []) for p in fin],
            *[(p, ["civic"], []) for p in civic],
        )
        result = match_winners(hackathon(), ["general"], ai + fin + civic, labels, NOW_YEAR)
        domains = {labels[m.project.uid]["domains"][0] for m in result.matches}
        assert len(domains) >= 3, "themeless grounding should show variety"

    def test_still_fills_the_quota_when_variety_runs_out(self):
        only_ai = [project(str(i)) for i in range(10)]
        labels = labels_for(*[(p, ["ai-ml"], []) for p in only_ai])
        result = match_winners(hackathon(), ["general"], only_ai, labels, NOW_YEAR, limit=6)
        assert len(result.matches) == 6
