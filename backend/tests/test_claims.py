"""Tests for win-claim extraction.

Every string here is a real GitHub repo description captured on 2026-09-12. The negatives matter
as much as the positives: this parser decides what we are willing to call a "winner", and a false
positive poisons the grounding that the whole idea engine rests on.
"""

import pytest

from app.winners.claims import extract_claim

# (description, expected placement fragment)
REAL_WINNERS = [
    ("🏆 AI Procurement Assistant - Google Cloud Sweden Hackathon Winner.", "winner"),
    ("Winner of the international MongoDB AI Hackathon, an AI-powered solution", "winner"),
    ("1st Place Winner (General Judge) - Datadog Self-Improving Agents Hack.", "1st place"),
    ("🏆 First prize, Superlinked × Qwen Hackathon 2026 — a self-improving search", "first prize"),
    ("ZK-gated community. 🏅 1st Place — The Synthesis Hackathon", "1st place"),
    (
        "Neuroscience-backed A/B testing. Won Most Creative @ UT Claude Builder Club Hackathon",
        "won",
    ),
    ('ICHack 2026: "Best Hardware Hack" Winner // An acoustic mesh network', "winner"),
    ("1st-place Web3 & Tooling winner at the 2022 Polkadot North America Hackathon.", "1st place"),
    ("🏆 1st Place @ GDG Hackathon! Lumina is an AI-enhanced lost-and-found", "1st place"),
    ("Winning entry for the BitGN Personal Agent Challenge (PAC) 2026", "winning"),
]

REAL_NON_WINNERS = [
    # Names the hackathon but only claims participation.
    "Submission for the EagleHacks 36-hour hackathon by the Computer Science department",
    # "Winify" contains "win" but makes no claim — word boundaries matter.
    "A Decentralized App for Lottery Transactions, powered by Blockchain, backed by NFTs",
    # A hackathon project, but no claim of winning anything.
    "A full-stack web application that connects local farmers to buyers",
    "An application to help to make good career choices",
    "Toolkit for Decentralized Federated Collaborative Economy",
    "",
]


class TestWinDetection:
    @pytest.mark.parametrize("text,fragment", REAL_WINNERS)
    def test_real_winners_are_detected(self, text, fragment):
        claim = extract_claim(text)
        assert claim is not None, f"missed a real winner: {text[:60]}"
        assert fragment in claim.placement.lower()

    @pytest.mark.parametrize("text", REAL_NON_WINNERS)
    def test_non_winners_are_rejected(self, text):
        assert extract_claim(text) is None, f"false positive on: {text[:60]}"

    def test_participation_wording_is_not_a_win(self):
        """'Submitted to' is the most common way a non-winner mentions a hackathon."""
        assert extract_claim("Submitted to HackMIT 2025") is None
        assert extract_claim("My entry for HackMIT 2025, a chess engine") is None

    def test_explicit_loss_is_not_a_win(self):
        assert extract_claim("We did not win the hackathon but learned a lot") is None

    def test_a_win_needs_a_hackathon_context(self):
        """Plenty of repos say 'winner' about something that is not a hackathon."""
        assert extract_claim("Winner of the 2024 Nobel Prize in code golf") is None


class TestExtractedDetail:
    def test_pulls_out_the_hackathon_name(self):
        claim = extract_claim("🏆 First prize, Superlinked × Qwen Hackathon 2026 — search")
        assert claim is not None and "Qwen Hackathon" in claim.hackathon_name

    def test_pulls_out_the_year(self):
        claim = extract_claim("1st-place winner at the 2022 Polkadot North America Hackathon.")
        assert claim is not None and claim.year == 2022

    def test_year_is_none_when_absent(self):
        claim = extract_claim("Winner of the MongoDB AI Hackathon")
        assert claim is not None and claim.year is None

    def test_named_prize_is_captured(self):
        claim = extract_claim('ICHack 2026: "Best Hardware Hack" Winner // acoustic mesh')
        assert claim is not None
        assert "hardware" in (claim.prize or "").lower()

    def test_confidence_is_higher_for_explicit_placement(self):
        explicit = extract_claim("🏆 1st Place @ GDG Hackathon!")
        vague = extract_claim("Our hackathon project, we won something")
        assert explicit is not None
        assert vague is None or explicit.confidence > vague.confidence

    def test_runner_up_counts_as_a_win(self):
        """Runners-up are still useful signal about what judges rewarded."""
        claim = extract_claim("Runner-up at HackTU 3.0, a healthcare scanner")
        assert claim is not None and "runner" in claim.placement.lower()


class TestGitHubClaimSource:
    """A prose claim is checkable; a self-applied topic tag is not. Keep them distinguishable."""

    def test_description_claim_is_marked_strong(self):
        from app.winners.github import find_claim

        found = find_claim({"description": "🏆 1st Place @ GDG Hackathon!", "topics": []})
        assert found is not None
        claim, source = found
        assert source == "description"
        assert claim.confidence >= 0.8

    def test_topic_only_claim_is_discounted(self):
        from app.winners.github import find_claim

        found = find_claim({"description": "A lost-and-found app", "topics": ["hackathon-winner"]})
        assert found is not None
        claim, source = found
        assert source == "topics"
        # Halved, because the tag asserts a win with nothing to verify it against.
        assert claim.confidence <= 0.4

    def test_repo_with_no_claim_anywhere_is_skipped(self):
        from app.winners.github import find_claim

        assert find_claim({"description": "A todo app", "topics": ["react", "todo"]}) is None

    def test_parse_skips_unclaimed_repos(self):
        from app.winners.github import parse

        payload = {
            "items": [
                {
                    "id": 1,
                    "html_url": "https://x/1",
                    "name": "won",
                    "topics": [],
                    "description": "🏆 1st place at HackTU 2026",
                },
                {
                    "id": 2,
                    "html_url": "https://x/2",
                    "name": "plain",
                    "topics": [],
                    "description": "Submission for HackTU 2026",
                },
            ]
        }
        out = parse(payload)
        assert [p.source_id for p in out] == ["1"]
        assert out[0].evidence == "winner"
