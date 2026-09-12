"""Shared plumbing for source adapters.

Each adapter splits into a pure `parse(payload)` and an I/O `fetch()`. Only parsing is tested,
because parsing is what breaks when a site redesigns — and pure functions can be tested against
saved fixtures with no network.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Protocol

import httpx
from dateutil import parser as dateparser

from app.models import HackathonRecord

#: Identifies us to the sites we read, so an operator can see who we are and contact us.
USER_AGENT = "HackRadar/0.1 (+https://github.com/hackradar/hackradar; open-source student tool)"

#: Politeness floor between requests to the same host.
MIN_INTERVAL_SECONDS = 1.0


class Source(Protocol):
    name: str

    def fetch(self) -> list[HackathonRecord]: ...


def parse_dt(value: Any) -> datetime | None:
    """Lenient date parsing — sources disagree on format and often omit dates entirely."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return dateparser.parse(str(value))
    except (ValueError, OverflowError, TypeError):
        return None


class PoliteClient:
    """An httpx client that identifies itself and never hammers a host."""

    def __init__(self, timeout: float = 30.0, min_interval: float = MIN_INTERVAL_SECONDS):
        self._client = httpx.Client(
            timeout=timeout,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
        self._min_interval = min_interval
        self._last_request_at = 0.0

    def _wait(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request_at = time.monotonic()

    def get(self, url: str, **kwargs) -> httpx.Response:
        self._wait()
        response = self._client.get(url, **kwargs)
        response.raise_for_status()
        return response

    def post(self, url: str, **kwargs) -> httpx.Response:
        self._wait()
        response = self._client.post(url, **kwargs)
        response.raise_for_status()
        return response

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> PoliteClient:
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()
