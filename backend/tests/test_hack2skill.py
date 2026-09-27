import copy
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from app.jobs.export_site import to_web
from app.sources import hack2skill as h2s

FIXTURES = Path(__file__).parent / "fixtures" / "hack2skill"


def load(name):
    return json.loads((FIXTURES / name).read_text())


def row(id="one", **kwargs):
    return {
        "_id": id,
        "eventUrl": id,
        "title": f"Hack {id}",
        "registrationEnd": "2099-10-01T00:00:00Z",
        **kwargs,
    }


class Client:
    def __init__(self, pages, details=None, robots="User-agent: *\nAllow: /\n"):
        self.pages = pages
        self.details = details or {"success": True, "data": {"type": "HACKATHON"}}
        self.robots = robots
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(url)
        if url.endswith("/robots.txt"):
            return httpx.Response(200, text=self.robots)
        if url == h2s.LIST_URL:
            params = kwargs["params"]
            assert params["records"] == 9
            return httpx.Response(200, json=self.pages[params["page"] - 1])
        return httpx.Response(200, json=self.details)


def test_listing_dates_and_modes():
    records = h2s.parse(load("listing.json"))
    assert len(records) == 3
    assert records[0].mode == "in_person"
    assert records[2].mode == "hybrid"
    assert all(r.starts_at is None and r.ends_at is None for r in records)
    assert records[0].reg_deadline is not None
    assert "submissionStart" not in records[0].raw


def test_pagination_closed_and_blocked_before_details():
    client = Client(
        [
            {
                "success": True,
                "pages": 2,
                "data": [row(), row("blocked-child"), row("closed", registrationEnd="2000-01-01")],
            },
            {"success": True, "pages": 2, "data": [row("two")]},
        ],
        robots="User-agent: *\nAllow: /\nDisallow: /event/blocked\n",
    )
    records = h2s.fetch(client)
    assert [r.source_id for r in records] == ["one", "two"]
    assert sum(url.endswith("/robots.txt") for url in client.calls) == 1
    assert not any("/blocked-child/" in url or "/closed/" in url for url in client.calls)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"success": False, "data": []},
        {"success": True, "data": {}},
        {"success": True, "data": [{"eventUrl": "missing-id"}]},
    ],
)
def test_invalid_listing(payload):
    with pytest.raises(ValueError):
        h2s.parse(payload)


def test_repeated_page_and_empty_page():
    page = {"success": True, "pages": 2, "data": [row()]}
    with pytest.raises(ValueError, match="Repeated"):
        h2s.fetch(Client([page, page]))
    with pytest.raises(ValueError, match="Empty"):
        h2s.fetch(Client([{**page, "data": []}]))


def test_ceiling():
    pages = [
        {"success": True, "pages": 101, "data": [row(str(i), registrationEnd="2000-01-01")]}
        for i in range(100)
    ]
    with pytest.raises(ValueError, match="100 pages"):
        h2s.fetch(Client(pages))


def test_robots_failure_and_detail_failure():
    page = {"success": True, "pages": 1, "data": [row()]}
    with pytest.raises(ValueError, match="robots"):
        h2s.fetch(Client([page], robots="<html>error</html>"))
    with pytest.raises(ValueError, match="detail"):
        h2s.fetch(Client([page], details={"success": False}))


def test_calendar_year_shift():
    now = datetime(2024, 2, 29, tzinfo=UTC)
    assert h2s.shift_year(now, -2) == datetime(2022, 2, 28, tzinfo=UTC)
    assert h2s.shift_year(now, 1) == datetime(2025, 2, 28, tzinfo=UTC)


def test_detail_fixture_and_non_hackathon():
    record = h2s.parse(load("listing.json"))[2]
    detail = load("detail.json")
    parsed = h2s.parse_detail(record, detail)
    assert parsed.team_min == 2 and parsed.team_max == 4
    assert "foundational" in parsed.description
    assert parsed.starts_at is None and parsed.prize_amount is None
    assert "impressions" not in json.dumps(parsed.model_dump(mode="json"))
    assert "support@hack2skill" not in json.dumps(parsed.raw)
    detail["data"]["type"] = "BOOTCAMP"
    assert h2s.parse_detail(record, detail) is None
    assert h2s.fetch(Client([{"success": True, "pages": 1, "data": [row()]}], details=detail)) == []


def test_visible_eligibility_prizes_problems_and_hidden_data():
    record = h2s.parse({"success": True, "data": [row()]})[0]
    detail = {
        "success": True,
        "data": {
            "type": "HACKATHON",
            "tags": {"teamSize": {"min": 1, "max": 6, "isHidden": True}},
            "sections": [
                {
                    "type": "OVERVIEW",
                    "category": [
                        {
                            "type": "ELIGIBILTY",
                            "data": [
                                {"eligibility": "Indian students", "prize": "Cloud credits"},
                                {"isHidden": True, "eligibility": "SECRET"},
                            ],
                        }
                    ],
                },
                {
                    "type": "CHALLENGES",
                    "category": [
                        {
                            "data": [
                                {
                                    "title": "Challenge",
                                    "description": "<p>Build accessible tools</p>",
                                    "link": "https://example.org/problem.pdf",
                                    "tags": [{"isHidden": True, "value": "SECRET"}],
                                    "content": [{"isHidden": True, "value": "SECRET"}],
                                },
                                {"isHidden": True, "title": "SECRET"},
                            ]
                        }
                    ],
                },
                {
                    "type": "ABOUT",
                    "isHidden": True,
                    "category": [{"data": [{"description": "SECRET"}]}],
                },
                {
                    "type": "ABOUT",
                    "category": [{"isHidden": True, "data": [{"description": "SECRET"}]}],
                },
            ],
        },
    }
    parsed = h2s.parse_detail(record, detail)
    assert parsed.eligibility_text == "Indian students"
    assert parsed.description == "Advertised prize: Cloud credits"
    assert parsed.prize_amount is None and parsed.team_max is None
    assert any(p.kind == "pdf" for p in parsed.problem_sources)
    assert any(p.text == "Build accessible tools" for p in parsed.problem_sources)
    assert "SECRET" not in json.dumps(parsed.model_dump(mode="json"))
    assert "SECRET" not in json.dumps(to_web(parsed))
    assert record.eligibility_text is None  # pure parser leaves the input alone
    hidden = copy.deepcopy(detail)
    hidden["data"]["sections"][1]["isHidden"] = True
    assert not h2s.parse_detail(record, hidden).problem_sources


def test_spaces_in_slugs_are_encoded_and_still_blocked():
    page = {"success": True, "pages": 1, "data": [row("with-space", eventUrl="prompt battle")]}
    record = h2s.parse(page)[0]
    assert record.url == "https://hack2skill.com/event/prompt%20battle/"
    client = Client([page])
    assert len(h2s.fetch(client)) == 1
    assert h2s.DETAIL_URL.format(slug="prompt%20battle") in client.calls
    blocked = Client([page], robots="User-agent: *\nDisallow: /event/prompt battle\n")
    assert h2s.fetch(blocked) == []
    assert not any(url.endswith("/event-details") for url in blocked.calls)


@pytest.mark.parametrize("slug", ["../private", "%2e%2e", "%2fadmin", "x?secret=1", "x#secret"])
def test_slugs_cannot_change_the_request_path(slug):
    with pytest.raises(ValueError, match="identity"):
        h2s.parse({"success": True, "data": [row(eventUrl=slug)]})


def test_unpublished_rows_do_not_truncate_pagination():
    pages = [
        {"success": True, "pages": 2, "data": [row("unpublished", eventUrl=None)]},
        {"success": True, "pages": 2, "data": [row("public")]},
    ]
    client = Client(pages)
    assert [r.source_id for r in h2s.fetch(client)] == ["public"]
    assert len([url for url in client.calls if url.endswith("/event-details")]) == 1
