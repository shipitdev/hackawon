"""Tests for the sponsor-tech guard.

Every string below is a real project summary from the corpus. The model kept assigning
`sponsor-tech` from the hackathon's name alone — "winner of the Bytom blockchain challenge" says
nothing about what the project was built on. Tightening the prompt took it from 266 assignments to
209, still 69% of all reasons given, so a deterministic check does the rest.

The rule: keep `sponsor-tech` only when the text says the project was built ON something.
"""

from app.taxonomy import prune_unsupported_patterns

# Real summaries where the label IS supported.
SUPPORTED = [
    "An immersive AR iOS game where you win by running. Uses healthKit to track steps",
    "The Pollen Protocol. Built on the Lens Protocol. Won FIRST PRIZE in Polygon BUIDLIT",
    "A tutoring platform powered by the Gemini API, winner at GDG Hackathon",
    "Built with Supabase and ElevenLabs for the voice layer",
]

# Real summaries where it was inferred from the event name and nothing else.
UNSUPPORTED = [
    "An interactive Data Profiling tool for automated EDA, and Data Integrity Rating",
    "Goodbye online exams. 1st runner up of Eduthon Hackathon",
    "This repository is for my contribution to the 2022 Arctic Challenge Hackathon in Sweden",
    "Proof of concept for the Junction 2018 hackathon. Winner of the Bytom blockchain challenge.",
]


def labels(*patterns):
    return {"domains": ["ai-ml"], "archetype": "web-app", "winning_patterns": list(patterns)}


class TestSponsorTechGuard:
    def test_keeps_it_when_the_text_names_what_was_built_on(self):
        for text in SUPPORTED:
            out = prune_unsupported_patterns(labels("sponsor-tech"), text)
            assert "sponsor-tech" in out["winning_patterns"], text[:50]

    def test_drops_it_when_only_the_event_name_suggested_it(self):
        for text in UNSUPPORTED:
            out = prune_unsupported_patterns(labels("sponsor-tech"), text)
            assert "sponsor-tech" not in out["winning_patterns"], text[:50]

    def test_other_patterns_are_untouched(self):
        """The guard is about one specific unreliable label, not a general filter."""
        out = prune_unsupported_patterns(
            labels("sponsor-tech", "working-demo", "impact"),
            "A data profiling tool",
        )
        assert out["winning_patterns"] == ["working-demo", "impact"]

    def test_labels_without_the_pattern_pass_through_unchanged(self):
        original = labels("technical-depth")
        assert prune_unsupported_patterns(original, "anything")["winning_patterns"] == [
            "technical-depth"
        ]

    def test_empty_text_drops_an_unverifiable_claim(self):
        out = prune_unsupported_patterns(labels("sponsor-tech"), "")
        assert out["winning_patterns"] == []

    def test_does_not_mutate_the_input(self):
        original = labels("sponsor-tech")
        prune_unsupported_patterns(original, "nothing here")
        assert original["winning_patterns"] == ["sponsor-tech"]

    def test_case_does_not_matter(self):
        out = prune_unsupported_patterns(labels("sponsor-tech"), "BUILT ON THE LENS PROTOCOL")
        assert "sponsor-tech" in out["winning_patterns"]
