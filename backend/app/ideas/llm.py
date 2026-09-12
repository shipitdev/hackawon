"""LLM access, behind a small interface.

Two implementations: Gemini (free tier) and a deterministic Fake used by tests and by contributors
who have no API key, so `pytest` and local development never spend money or need secrets.

Only one operation is needed — "here is a prompt and a JSON schema, give me matching JSON" — so
that is the entire interface.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Protocol

import httpx

#: Pinned deliberately. `gemini-2.5-flash-lite` began returning 404 "no longer available to new
#: users" in September 2026; these ids churn, so keep it explicit and expect to revisit.
DEFAULT_MODEL = "gemini-3.5-flash-lite"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

#: Free tier is roughly 15 requests/minute. Stay under it rather than relying on retries.
MIN_INTERVAL = 4.5


class LLMError(RuntimeError):
    pass


class LLM(Protocol):
    name: str

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> Any: ...


class FakeLLM:
    """Returns schema-shaped filler. Never calls the network.

    For array schemas it echoes back the `id="..."` values found in the prompt, one row each, so
    the whole batching-and-caching pipeline can be exercised offline — a double that returned a
    single generic row would make every batch look like a total failure.
    """

    name = "fake"
    _ID = re.compile(r'id="([^"]+)"')

    def __init__(self) -> None:
        self.calls: list[str] = []

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> Any:
        self.calls.append(prompt)
        if (schema.get("type") or "").upper() == "ARRAY":
            ids = self._ID.findall(prompt)
            if ids:
                return [{**self._from_schema(schema["items"]), "id": key} for key in ids]
        return self._from_schema(schema)

    def _from_schema(self, schema: dict[str, Any]) -> Any:
        kind = (schema.get("type") or "STRING").upper()
        if kind == "ARRAY":
            return [self._from_schema(schema["items"])]
        if kind == "OBJECT":
            return {k: self._from_schema(v) for k, v in (schema.get("properties") or {}).items()}
        if kind == "BOOLEAN":
            return True
        if kind in {"NUMBER", "INTEGER"}:
            return 0
        enum = schema.get("enum")
        return enum[0] if enum else "fake"


class GeminiLLM:
    """Google's free tier. Structured output means responses are schema-valid, not parsed prose."""

    name = "gemini"

    def __init__(self, api_key: str | None = None, model: str = DEFAULT_MODEL, timeout: float = 90):
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise LLMError("GEMINI_API_KEY is not set")
        self._key = key
        self._model = model
        self._client = httpx.Client(timeout=timeout)
        self._last_call = 0.0

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_call
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)
        self._last_call = time.monotonic()

    def generate_json(self, prompt: str, schema: dict[str, Any], attempts: int = 4) -> Any:
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                # Labelling should be reproducible; creativity is not wanted here.
                "temperature": 0.0,
            },
        }
        url = GEMINI_URL.format(model=self._model)
        last_error: Exception | None = None

        for attempt in range(attempts):
            self._throttle()
            try:
                response = self._client.post(
                    url,
                    params={"key": self._key},
                    json=body,
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code == 429:
                    # Rate limited: back off rather than hammering a free quota.
                    time.sleep(20 * (attempt + 1))
                    last_error = LLMError("rate limited")
                    continue
                response.raise_for_status()
                payload = response.json()
                text = payload["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
            except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
                last_error = exc
                time.sleep(2 * (attempt + 1))

        raise LLMError(f"Gemini failed after {attempts} attempts: {last_error}")

    def close(self) -> None:
        self._client.close()


def get_llm(name: str | None = None) -> LLM:
    """Pick a provider. Defaults to fake so nothing accidentally spends quota."""
    choice = (name or os.environ.get("LLM_PROVIDER") or "fake").lower()
    if choice == "gemini":
        return GeminiLLM()
    if choice == "fake":
        return FakeLLM()
    raise LLMError(f"Unknown LLM provider: {choice}")
