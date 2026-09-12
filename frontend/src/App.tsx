import { useEffect, useMemo, useState } from "react";
import type { Bundle, Hackathon, Mode } from "./types";
import {
  applyFilters,
  deadlineLabel,
  EMPTY_FILTERS,
  formatDates,
  formatPrize,
  isUrgent,
  where,
  type Filters,
} from "./lib";

const SOURCE_LABELS: Record<string, string> = {
  devfolio: "Devfolio",
  unstop: "Unstop",
  mlh: "MLH",
};

const MODES: { value: Mode | "all"; label: string }[] = [
  { value: "all", label: "Anywhere" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
];

function chipClass(active: boolean): string {
  return [
    "inline-flex items-center rounded-full border px-3 py-1 text-sm transition",
    active
      ? "border-accent bg-accent/12 text-accent"
      : "border-line text-muted hover:border-accent/40 hover:text-ink",
  ].join(" ");
}

function Pill({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "urgent" | "topic";
}) {
  const styles =
    tone === "urgent"
      ? "bg-accent/12 text-accent border-accent/25"
      : tone === "topic"
        ? "bg-ink/6 text-ink/80 border-line font-medium"
        : "bg-ink/4 text-muted border-line";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${styles}`}>
      {children}
    </span>
  );
}

function Card({ h, topics }: { h: Hackathon; topics: Map<string, string> }) {
  const deadline = deadlineLabel(h);
  const prize = formatPrize(h);
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug group-hover:text-accent">{h.title}</h3>
        <span className="shrink-0 text-xs text-muted">{SOURCE_LABELS[h.source] ?? h.source}</span>
      </div>

      {h.tagline && <p className="line-clamp-2 text-sm text-muted">{h.tagline}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {deadline && <Pill tone="urgent">{deadline}</Pill>}
        <Pill>{formatDates(h)}</Pill>
        <Pill>{where(h)}</Pill>
        {prize && <Pill>{prize}</Pill>}
        {h.team_max && <Pill>Team up to {h.team_max}</Pill>}
        {h.domains.map((d) => (
          <Pill key={d} tone="topic">
            {topics.get(d) ?? d}
          </Pill>
        ))}
      </div>

      {h.tracks.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-medium">Tracks:</span> {h.tracks.slice(0, 3).join(" · ")}
          {h.tracks.length > 3 && ` +${h.tracks.length - 3}`}
        </p>
      )}
    </a>
  );
}

export default function App() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/hackathons.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setBundle)
      .catch((e) => setError(String(e)));
  }, []);

  const all = bundle?.hackathons ?? [];
  const shown = useMemo(() => applyFilters(all, filters), [all, filters]);
  const urgentCount = useMemo(() => all.filter((h) => isUrgent(h)).length, [all]);
  const topicLabels = useMemo(
    () => new Map((bundle?.domains ?? []).map((d) => [d.id, d.label])),
    [bundle],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">HackRadar</h1>
        <p className="mt-1 text-sm text-muted">
          Upcoming hackathons for students, gathered from Devfolio, Unstop and MLH.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search by name, city, theme or sponsor…"
          aria-label="Search hackathons"
          className="min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={filters.mode}
          onChange={(e) => set("mode", e.target.value as Mode | "all")}
          aria-label="Filter by mode"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={filters.source}
          onChange={(e) => set("source", e.target.value)}
          aria-label="Filter by source"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => set("onlyUrgent", !filters.onlyUrgent)}
          aria-pressed={filters.onlyUrgent}
          className={`rounded-lg border px-3 py-2 text-sm transition ${
            filters.onlyUrgent
              ? "border-accent bg-accent/12 text-accent"
              : "border-line hover:border-accent/40"
          }`}
        >
          Closing soon{urgentCount > 0 && ` (${urgentCount})`}
        </button>
      </div>

      {bundle && bundle.domains.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => set("domain", "all")}
            aria-pressed={filters.domain === "all"}
            className={chipClass(filters.domain === "all")}
          >
            All topics
          </button>
          {bundle.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => set("domain", filters.domain === d.id ? "all" : d.id)}
              aria-pressed={filters.domain === d.id}
              className={chipClass(filters.domain === d.id)}
            >
              {d.label}
              <span className="ml-1.5 opacity-60">{d.count}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-line p-4 text-sm text-muted">
          Could not load hackathons: {error}
        </p>
      )}

      {!bundle && !error && <p className="text-sm text-muted">Loading…</p>}

      {bundle && (
        <>
          <p className="mb-3 text-sm text-muted">
            {shown.length} of {all.length} hackathons
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((h) => (
              <Card key={h.uid} h={h} topics={topicLabels} />
            ))}
          </div>
          {shown.length === 0 && (
            <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
              Nothing matches those filters.
            </p>
          )}
          <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
            Updated {new Date(bundle.generated_at).toLocaleString("en-IN")} · open source ·
            listings link to the organiser's own page
          </footer>
        </>
      )}
    </div>
  );
}
