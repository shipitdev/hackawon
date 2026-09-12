"""Tests for labelling.

The expensive mistakes here are silent: a broken cache key quietly burns API quota on every run,
and accepting an off-list label quietly breaks every filter that depends on the vocabulary.
"""

import pytest

from app import taxonomy as tax_mod
from app.ideas.llm import FakeLLM
from app.models import HackathonRecord, ProjectRecord
from app.taxonomy import classify, hackathon_text, load_taxonomy, project_text


@pytest.fixture
def labels_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(tax_mod, "LABELS_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def tax():
    return load_taxonomy()


def hackathon(**kw) -> HackathonRecord:
    base = dict(source="devfolio", source_id="1", title="AI Hack", url="https://x/")
    return HackathonRecord(**{**base, **kw})


class TestTaxonomyFile:
    def test_loads_and_has_the_expected_axes(self, tax):
        assert tax.version >= 1
        assert "ai-ml" in tax.domain_ids
        assert "general" in tax.domain_ids
        assert "web-app" in tax.archetype_ids
        assert "sponsor-tech" in tax.pattern_ids

    def test_ids_are_unique(self, tax):
        for ids in (tax.domain_ids, tax.archetype_ids, tax.pattern_ids):
            assert len(ids) == len(set(ids))

    def test_every_domain_has_a_human_label(self, tax):
        assert all(d.get("label") for d in tax.domains)


class TestCaching:
    def test_second_run_makes_no_api_calls(self, labels_dir, tax):
        """The whole cost model depends on this: re-running must be free."""
        llm = FakeLLM()
        items = {"devfolio:1": "an AI hackathon about agents"}

        classify("hackathons", items, llm, tax)
        assert len(llm.calls) == 1

        classify("hackathons", items, llm, tax)
        assert len(llm.calls) == 1, "cached items must not be sent again"

    def test_changed_text_is_relabelled(self, labels_dir, tax):
        llm = FakeLLM()
        classify("hackathons", {"devfolio:1": "an AI hackathon"}, llm, tax)
        classify("hackathons", {"devfolio:1": "a fintech hackathon"}, llm, tax)
        assert len(llm.calls) == 2

    def test_new_taxonomy_version_invalidates_everything(self, labels_dir, tax):
        from dataclasses import replace

        llm = FakeLLM()
        items = {"devfolio:1": "an AI hackathon"}
        classify("hackathons", items, llm, tax)
        classify("hackathons", items, llm, replace(tax, version=tax.version + 1))
        assert len(llm.calls) == 2

    def test_force_relabels(self, labels_dir, tax):
        llm = FakeLLM()
        items = {"devfolio:1": "an AI hackathon"}
        classify("hackathons", items, llm, tax)
        classify("hackathons", items, llm, tax, force=True)
        assert len(llm.calls) == 2

    def test_only_unlabelled_items_are_sent(self, labels_dir, tax):
        llm = FakeLLM()
        classify("hackathons", {"a": "one"}, llm, tax)
        classify("hackathons", {"a": "one", "b": "two"}, llm, tax)
        assert "b" in llm.calls[-1] and '"a"' not in llm.calls[-1].split("Hackathons:")[-1]


class TestResponseValidation:
    def test_rows_for_unknown_ids_are_discarded(self, labels_dir, tax):
        """A model that invents an id must not inject a phantom record."""

        class Liar(FakeLLM):
            def generate_json(self, prompt, schema):
                return [{"id": "not-a-real-uid", "domains": ["ai-ml"]}]

        out = classify("hackathons", {"devfolio:1": "text"}, Liar(), tax)
        assert out == {}

    def test_batch_failure_does_not_lose_other_batches(self, labels_dir, tax, monkeypatch):
        monkeypatch.setattr(tax_mod, "BATCH_SIZE", 1)

        class Flaky(FakeLLM):
            def generate_json(self, prompt, schema):
                if "boom" in prompt:
                    raise RuntimeError("provider exploded")
                return super().generate_json(prompt, schema)

        out = classify("hackathons", {"a": "fine", "b": "boom"}, Flaky(), tax)
        assert set(out) == {"a"}


class TestTextForLabelling:
    def test_uses_the_fields_that_describe_the_subject(self):
        text = hackathon_text(
            hackathon(tagline="Build for farmers", tracks=["Best AI Hack"], sponsors=["ElevenLabs"])
        )
        assert "farmers" in text and "Best AI Hack" in text and "ElevenLabs" in text

    def test_ignores_volatile_fields(self):
        """Registration counts change hourly; including them would re-bill every run."""
        a = hackathon_text(hackathon(participants_count=10))
        b = hackathon_text(hackathon(participants_count=9999))
        assert a == b

    def test_project_text_includes_the_win(self):
        project = ProjectRecord(
            source="github",
            source_id="1",
            title="Haven",
            url="https://x/",
            evidence="winner",
            summary="AI safety app",
            hackathon_name="MongoDB AI Hackathon",
            prize="1st place",
            tech=["Python"],
        )
        text = project_text(project)
        assert "MongoDB AI Hackathon" in text and "1st place" in text and "Python" in text


class TestPartialSaves:
    def test_progress_survives_a_crash_mid_run(self, labels_dir, tax, monkeypatch):
        """Labelling the winners corpus takes ~12 minutes; losing it all to one crash near the
        end would waste both time and free-tier quota."""
        monkeypatch.setattr(tax_mod, "BATCH_SIZE", 1)
        monkeypatch.setattr(tax_mod, "SAVE_EVERY", 1)

        class DiesLate(FakeLLM):
            def generate_json(self, prompt, schema):
                if "item7" in prompt:
                    raise KeyboardInterrupt("user gave up")
                return super().generate_json(prompt, schema)

        items = {f"uid{i}": f"item{i}" for i in range(9)}
        with pytest.raises(KeyboardInterrupt):
            classify("hackathons", items, DiesLate(), tax)

        # A fresh run should only need the items that never got labelled.
        llm = FakeLLM()
        classify("hackathons", items, llm, tax)
        assert len(llm.calls) < len(items), "earlier batches should have been cached"
