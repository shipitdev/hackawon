"""The curated toolkit: tools worth knowing about during a hackathon.

Hand-written in `data/tools.yml`, unlike everything else here, which is scraped. That is
deliberate — the value is in the judgement, not the volume, and it makes the file the easiest
place for a contributor to help.

The hard problem is freshness, not collection. Free tiers change without notice: during this
project Google retired a Gemini model mid-build, and xAI's $150/month free credits ended in May
2025 while much of the internet still recommends them. So every entry carries the date a human
last checked it, and the UI greys out anything older than `STALE_AFTER_DAYS` rather than
presenting it as current.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import yaml

from app.store import DATA_DIR

TOOLS_PATH = DATA_DIR / "tools.yml"

#: An entry unchecked for a quarter is shown as possibly out of date.
STALE_AFTER_DAYS = 90

#: Ordered as they appear on the page: roughly the order you need them during a hackathon.
CATEGORIES: dict[str, str] = {
    "ai-credits": "AI & model APIs",
    "auth": "Auth & backend",
    "database": "Databases",
    "hosting": "Hosting your demo",
    "slides": "Slides & demoing",
    "ui-kits": "Making it look finished",
    "datasets": "Data to build on",
    "dev-tools": "Small time-savers",
}


@dataclass(frozen=True)
class Tool:
    name: str
    url: str
    category: str
    what_you_get: str
    checked: date
    free: bool = True
    caveat: str | None = None

    @property
    def stale(self) -> bool:
        return is_stale(self.checked)


def is_stale(checked: date, today: date | None = None) -> bool:
    return ((today or date.today()) - checked).days > STALE_AFTER_DAYS


def load_tools(path: Path | None = None) -> list[Tool]:
    data = yaml.safe_load((path or TOOLS_PATH).read_text(encoding="utf-8"))
    tools = []
    for entry in data.get("tools", []):
        checked = entry["checked"]
        tools.append(
            Tool(
                name=entry["name"],
                url=entry["url"],
                category=entry["category"],
                what_you_get=entry["what_you_get"],
                checked=checked if isinstance(checked, date) else date.fromisoformat(str(checked)),
                free=bool(entry.get("free", True)),
                caveat=entry.get("caveat"),
            )
        )
    return tools


def to_web(tools: list[Tool]) -> dict:
    """Group by category for the page, keeping the category order defined above."""
    grouped: dict[str, list[dict]] = {key: [] for key in CATEGORIES}
    for tool in tools:
        grouped[tool.category].append(
            {
                "name": tool.name,
                "url": tool.url,
                "what_you_get": tool.what_you_get,
                "caveat": tool.caveat,
                "free": tool.free,
                "checked": tool.checked.isoformat(),
                "stale": tool.stale,
            }
        )
    return {
        "categories": [
            {"id": key, "label": label, "tools": grouped[key]}
            for key, label in CATEGORIES.items()
            if grouped[key]
        ],
        "count": len(tools),
        "stale_after_days": STALE_AFTER_DAYS,
    }
