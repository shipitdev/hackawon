"""Label hackathons and past projects against the shared taxonomy.

Three rules shape this module:

* **Closed vocabulary.** The model may only pick ids from `data/taxonomy.yml`; anything else is
  dropped. Free-form tags drift ("AI" / "A.I." / "ml") and make filtering unreliable.
* **Batched.** Items go up several at a time. 937 individual calls would take hours against a free
  tier limited to ~15 requests/minute; batches of 8 turn that into roughly 120 calls.
* **Cached by content hash.** Re-running costs nothing unless an item's text or the taxonomy
  version actually changed.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from app.ideas.llm import LLM
from app.models import HackathonRecord, ProjectRecord
from app.store import DATA_DIR

TAXONOMY_PATH = DATA_DIR / "taxonomy.yml"
LABELS_DIR = DATA_DIR / "labels"
BATCH_SIZE = 8


@dataclass(frozen=True)
class Taxonomy:
    version: int
    domains: list[dict[str, str]]
    archetypes: list[dict[str, str]]
    winning_patterns: list[dict[str, str]]

    @property
    def domain_ids(self) -> list[str]:
        return [d["id"] for d in self.domains]

    @property
    def archetype_ids(self) -> list[str]:
        return [a["id"] for a in self.archetypes]

    @property
    def pattern_ids(self) -> list[str]:
        return [p["id"] for p in self.winning_patterns]

    def describe_domains(self) -> str:
        return "\n".join(f"- {d['id']}: {d['label']} — {d.get('hint', '')}" for d in self.domains)

    def describe_archetypes(self) -> str:
        return "\n".join(f"- {a['id']}: {a['label']}" for a in self.archetypes)

    def describe_patterns(self) -> str:
        return "\n".join(
            f"- {p['id']}: {p['label']} — {p.get('hint', '')}" for p in self.winning_patterns
        )


def load_taxonomy(path: Path | None = None) -> Taxonomy:
    data = yaml.safe_load((path or TAXONOMY_PATH).read_text(encoding="utf-8"))
    return Taxonomy(
        version=int(data["version"]),
        domains=data["domains"],
        archetypes=data["archetypes"],
        winning_patterns=data["winning_patterns"],
    )


def _digest(text: str, version: int) -> str:
    return hashlib.sha256(f"v{version}\n{text}".encode()).hexdigest()[:16]


def hackathon_text(h: HackathonRecord) -> str:
    """Only the fields that say what a hackathon is about — keeps the cache key stable when
    unrelated fields (registration counts, timestamps) change."""
    parts = [h.title, h.tagline or "", " ".join(h.themes), " ".join(h.tracks)]
    parts.append(" ".join(h.sponsors))
    parts.append((h.description or "")[:600])
    return " | ".join(p for p in parts if p.strip())


def project_text(p: ProjectRecord) -> str:
    parts = [p.title, p.tagline or "", p.summary or "", " ".join(p.tech)]
    if p.hackathon_name:
        parts.append(f"won at {p.hackathon_name}")
    if p.prize:
        parts.append(f"prize: {p.prize}")
    return " | ".join(part for part in parts if part.strip())


def _load_cache(kind: str) -> dict[str, dict[str, Any]]:
    path = LABELS_DIR / f"{kind}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _save_cache(kind: str, cache: dict[str, dict[str, Any]]) -> Path:
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    path = LABELS_DIR / f"{kind}.json"
    path.write_text(
        json.dumps(cache, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8"
    )
    return path


def _hackathon_schema(tax: Taxonomy) -> dict[str, Any]:
    return {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "id": {"type": "STRING"},
                "domains": {
                    "type": "ARRAY",
                    "items": {"type": "STRING", "enum": tax.domain_ids},
                },
            },
            "required": ["id", "domains"],
        },
    }


def _project_schema(tax: Taxonomy) -> dict[str, Any]:
    return {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "id": {"type": "STRING"},
                "domains": {"type": "ARRAY", "items": {"type": "STRING", "enum": tax.domain_ids}},
                "archetype": {"type": "STRING", "enum": tax.archetype_ids},
                "winning_patterns": {
                    "type": "ARRAY",
                    "items": {"type": "STRING", "enum": tax.pattern_ids},
                },
            },
            "required": ["id", "domains", "archetype", "winning_patterns"],
        },
    }


def _hackathon_prompt(tax: Taxonomy, batch: list[tuple[str, str]]) -> str:
    items = "\n".join(f'{i}. id="{key}" :: {text[:700]}' for i, (key, text) in enumerate(batch, 1))
    return f"""You are labelling student hackathons so they can be filtered by subject.

Pick 1-3 domains per hackathon from this list, most relevant first:
{tax.describe_domains()}

Rules:
- Use ONLY the ids above.
- Many student hackathons set no theme at all. When there is no clear subject, return exactly
  ["general"] rather than guessing a topic from the organiser's name.
- Do not use "general" together with other domains.
- Sponsor prizes and track names are the strongest signal of what a hackathon is about.

Hackathons:
{items}

Return one entry per hackathon, echoing its id exactly."""


def _project_prompt(tax: Taxonomy, batch: list[tuple[str, str]]) -> str:
    items = "\n".join(f'{i}. id="{key}" :: {text[:700]}' for i, (key, text) in enumerate(batch, 1))
    return f"""You are labelling projects that WON student hackathons, so future students can see
what tends to win.

Domains (pick 1-3, most relevant first):
{tax.describe_domains()}

Archetype — the shape of the thing built (pick exactly 1):
{tax.describe_archetypes()}

Winning patterns — why it likely beat the others (pick 0-3):
{tax.describe_patterns()}

Rules:
- Use ONLY the ids above.
- Only assign a winning pattern the text actually supports. If it just says "1st place" with no
  explanation, return an empty list. Inventing reasons makes the advice worthless.
- Prefer "general" for domain only when nothing more specific fits.

Projects:
{items}

Return one entry per project, echoing its id exactly."""


#: Persist part-way through: labelling the full winners corpus takes ~12 minutes against a free
#: tier, and losing all of it to one crash near the end would be infuriating and expensive.
SAVE_EVERY = 5


def _run_batches(
    llm: LLM,
    pairs: list[tuple[str, str]],
    schema: dict[str, Any],
    prompt_for,
    tax: Taxonomy,
    on_progress=None,
    on_partial=None,
) -> dict[str, dict[str, Any]]:
    labelled: dict[str, dict[str, Any]] = {}
    for index, start in enumerate(range(0, len(pairs), BATCH_SIZE), 1):
        batch = pairs[start : start + BATCH_SIZE]
        try:
            rows = llm.generate_json(prompt_for(tax, batch), schema)
        except Exception as exc:  # a bad batch must not lose the work already done
            print(f"    batch {index} failed: {type(exc).__name__}: {exc}")
            continue
        valid_keys = {key for key, _ in batch}
        for row in rows if isinstance(rows, list) else []:
            key = row.get("id")
            if key in valid_keys:
                labelled[key] = {k: v for k, v in row.items() if k != "id"}
        if on_partial and index % SAVE_EVERY == 0:
            on_partial(labelled)
        if on_progress:
            on_progress(min(start + BATCH_SIZE, len(pairs)), len(pairs))
    return labelled


def classify(
    kind: str,
    items: dict[str, str],
    llm: LLM,
    tax: Taxonomy | None = None,
    force: bool = False,
    on_progress=None,
) -> dict[str, dict[str, Any]]:
    """Label `items` (uid -> text). Returns uid -> labels, and updates the on-disk cache.

    Only items whose content hash changed are sent to the model, so a re-run with unchanged data
    makes zero API calls.
    """
    tax = tax or load_taxonomy()
    cache = {} if force else _load_cache(kind)

    pending = []
    for uid, text in items.items():
        digest = _digest(text, tax.version)
        cached = cache.get(uid)
        if cached and cached.get("hash") == digest:
            continue
        pending.append((uid, text))

    print(f"  {kind}: {len(items)} total, {len(pending)} need labelling")

    if pending:
        schema = _hackathon_schema(tax) if kind == "hackathons" else _project_schema(tax)
        prompt_for = _hackathon_prompt if kind == "hackathons" else _project_prompt

        def merge(fresh: dict[str, dict[str, Any]]) -> None:
            for uid, labels in fresh.items():
                cache[uid] = {**labels, "hash": _digest(items[uid], tax.version), "v": tax.version}

        def save_partial(fresh: dict[str, dict[str, Any]]) -> None:
            merge(fresh)
            _save_cache(kind, cache)

        fresh = _run_batches(llm, pending, schema, prompt_for, tax, on_progress, save_partial)
        merge(fresh)
        _save_cache(kind, cache)

    return {uid: cache[uid] for uid in items if uid in cache}


def normalise_domains(domains: list[str] | None) -> list[str]:
    """Drop the catch-all when real topics are present.

    "general" means "no particular subject", so ["ai-ml", "general"] is self-contradictory — and
    it inflates the count of themeless events. The model produced this for 78 of 675 winners,
    which is cheaper to fix here than to re-label.
    """
    values = [d for d in (domains or []) if d]
    specific = [d for d in values if d != "general"]
    return specific or (["general"] if values else [])
