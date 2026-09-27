import httpx
import pytest

from app.sources import devfolio, unstop


class Client:
    def __init__(self, handler):
        self.handler = handler

    def get(self, url, **kwargs):
        return httpx.Response(200, json=self.handler(url, kwargs))

    post = get


def test_unstop_eight_pages():
    def response(url, kwargs):
        params = kwargs["params"]
        assert params["oppstatus"] == "open"
        start = (params["page"] - 1) * 30
        return {
            "data": {
                "last_page": 8,
                "data": [
                    {"id": i + 1, "public_url": f"hackathons/hack-{i}"}
                    for i in range(start, min(start + 30, 218))
                ],
            }
        }

    assert len(unstop.fetch(Client(response))) == 218


def test_devfolio_multiple_pages():
    def response(url, kwargs):
        offset = kwargs["json"]["from"]
        return {
            "hits": {
                "total": {"value": 101},
                "hits": [
                    {"_source": {"uuid": str(i), "slug": f"hack-{i}"}}
                    for i in range(offset, min(offset + 50, 101))
                ],
            }
        }

    records = devfolio.fetch(Client(response))
    assert len(records) == len({r.uid for r in records}) == 101


@pytest.mark.parametrize(
    "module,payload",
    [
        (
            devfolio,
            {"hits": {"hits": [{"_source": {"uuid": str(i), "slug": str(i)}} for i in range(50)]}},
        ),
        (unstop, {"data": {"last_page": 3, "data": [{"id": 1, "public_url": "hackathons/one"}]}}),
    ],
)
def test_repeated_pages_raise(module, payload):
    with pytest.raises(ValueError, match="Repeated"):
        module.fetch(Client(lambda *_: payload))


@pytest.mark.parametrize("module", [devfolio, unstop])
def test_malformed_envelope(module):
    with pytest.raises(ValueError):
        module.fetch(Client(lambda *_: {}))


def test_unstop_empty_before_last_page():
    with pytest.raises(ValueError, match="Empty"):
        unstop.fetch(Client(lambda *_: {"data": {"last_page": 8, "data": []}}))


@pytest.mark.parametrize("module", [devfolio, unstop])
def test_safety_ceiling(module):
    def response(url, kwargs):
        if module is devfolio:
            offset = kwargs["json"]["from"]
            return {
                "hits": {
                    "hits": [
                        {"_source": {"uuid": str(i), "slug": str(i)}}
                        for i in range(offset, offset + 50)
                    ]
                }
            }
        page = kwargs["params"]["page"]
        return {
            "data": {"last_page": 101, "data": [{"id": page, "public_url": f"hackathons/{page}"}]}
        }

    with pytest.raises(ValueError, match="100 pages"):
        module.fetch(Client(response))


def test_mlh_season_boundary():
    from datetime import UTC, datetime

    from app.sources import mlh

    assert mlh.current_season(datetime(2027, 6, 30, tzinfo=UTC)) == 2027
    assert mlh.current_season(datetime(2027, 7, 1, tzinfo=UTC)) == 2028
    calls = []

    class CalendarClient:
        def get(self, url):
            calls.append(url)
            return httpx.Response(200, text="")

    mlh.fetch(CalendarClient(), season=2025)
    assert calls == ["https://mlh.com/seasons/2025/events"]
