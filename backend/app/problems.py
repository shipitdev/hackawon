"""Best-effort text extraction from problem-statement links published by organisers."""

from __future__ import annotations

import ipaddress
import re
from html import unescape
from urllib.parse import urlparse

from app.models import HackathonRecord
from app.sources.base import PoliteClient

_GOOGLE_DOC = re.compile(r"^https://docs\.google\.com/document/d/([^/]+)")
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
MAX_TEXT = 6000


def google_doc_export_url(url: str) -> str | None:
    match = _GOOGLE_DOC.match(url)
    return (
        f"https://docs.google.com/document/d/{match.group(1)}/export?format=txt" if match else None
    )


def _safe_link(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host == "localhost" or host.endswith(".local"):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True


def _response_text(response) -> str | None:
    content_type = (response.headers.get("content-type") or "").lower()
    if "pdf" in content_type:
        return None
    text = response.text
    if "html" in content_type:
        text = unescape(_TAG.sub(" ", text))
    text = _SPACE.sub(" ", text).strip()
    return text[:MAX_TEXT] if len(text) >= 40 else None


def enrich_problem_sources(records: list[HackathonRecord], client=None) -> int:
    """Fill public linked documents with text; failures leave the original link usable."""
    owns_client = client is None
    client = client or PoliteClient()
    parsed = 0
    try:
        for record in records:
            for source in record.problem_sources:
                if source.text or not source.url or source.kind == "pdf":
                    continue
                if not _safe_link(source.url):
                    source.status = "unavailable"
                    source.url = None
                    continue
                target = google_doc_export_url(source.url) or source.url
                # Only Google Docs has a stable public text endpoint. Other explicit links remain
                # clickable, but CI never fetches arbitrary organiser-controlled hosts.
                if urlparse(target).hostname != "docs.google.com":
                    continue
                try:
                    response = client.get(target)
                    if "text/plain" not in (response.headers.get("content-type") or "").lower():
                        continue
                    text = _response_text(response)
                except Exception:
                    continue
                if text:
                    source.text = text
                    source.status = "parsed"
                    parsed += 1
        return parsed
    finally:
        if owns_client:
            client.close()
