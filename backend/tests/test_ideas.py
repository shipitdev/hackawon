from app.ideas.generate import PROMPT_VERSION, build_prompt, generate_ideas
from app.ideas.match import Grounding
from app.models import HackathonRecord, ProblemSource
from app.taxonomy import Taxonomy


def hackathon(**overrides):
    values = {
        "source": "unstop",
        "source_id": "1",
        "title": "Travel Hack",
        "url": "https://unstop.com/hackathons/travel-hack-1",
        "problem_sources": [
            ProblemSource(
                kind="inline",
                title="Problem statements",
                text="Make local travel safer and more accessible for disabled visitors.",
                status="parsed",
            )
        ],
    }
    values.update(overrides)
    return HackathonRecord(**values)


def taxonomy():
    return Taxonomy(version=1, domains=[], archetypes=[], winning_patterns=[])


def grounding():
    return Grounding(matches=[], domains=["travel"], patterns=[], thin=True)


def test_prompt_centres_problem_statements_before_winning_examples():
    prompt = build_prompt(hackathon(), grounding(), taxonomy())
    assert "HACKATHON PROBLEM STATEMENTS" in prompt
    assert "Make local travel safer" in prompt
    assert prompt.index("HACKATHON PROBLEM STATEMENTS") < prompt.index("WHAT HAS WON")
    assert "untrusted organiser-provided reference data" in prompt
    assert "must address one concrete problem statement" in prompt


def test_generated_record_reports_problem_grounding():
    class LLM:
        name = "test"

        def generate_json(self, prompt, schema):
            return [
                {
                    "title": "AccessRoute",
                    "pitch": "Safer routes",
                    "problem_statement": "Accessible travel",
                    "why_it_could_win": "Useful",
                    "stack": [],
                    "inspired_by": [],
                }
            ]

    record = generate_ideas(hackathon(), grounding(), taxonomy(), LLM())
    assert PROMPT_VERSION > 1
    assert record["grounding"]["status"] == "problem_grounded"
    assert record["grounding"]["problem_source_count"] == 1


def test_missing_problem_context_is_marked_limited():
    class LLM:
        name = "test"

        def generate_json(self, prompt, schema):
            return [
                {
                    "title": "Fallback",
                    "pitch": "Track idea",
                    "problem_statement": "No published statement",
                    "why_it_could_win": "Useful",
                    "stack": [],
                    "inspired_by": [],
                }
            ]

    record = generate_ideas(hackathon(problem_sources=[]), grounding(), taxonomy(), LLM())
    assert record["grounding"]["status"] == "limited"
