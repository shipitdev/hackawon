import { useEffect, useMemo, useRef, useState } from "react";
import { Detail } from "./Detail";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { authConfigured, currentViewer, onViewerChange, signInWithGitHub, signOut } from "./auth";
import type { Viewer } from "./auth";
import { loadFavourites, persistFavourite, toggle, writeLocal } from "./favourites";
import { loadIndex } from "./data";
import type { Bundle, Hackathon, Mode } from "./types";
import {
  applyFilters,
  deadlineLabel,
  EMPTY_FILTERS,
  formatDates,
  formatPrize,
  isKnownAbroad,
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

function Pill({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "urgent" | "topic";
}) {
  const tones = {
    urgent: "border-accent/35 bg-accent/12 text-accent",
    topic: "border-accent-cool/25 bg-accent-cool/10 text-accent-cool",
    plain: "border-white/8 bg-white/[0.03] text-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] leading-5 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Card({
  h,
  topics,
  onOpen,
  saved,
  onToggleSave,
}: {
  h: Hackathon;
  topics: Map<string, string>;
  onOpen: () => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const deadline = deadlineLabel(h);
  const prize = formatPrize(h);
  const ideaCount = h.idea_count;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group card-lift reveal glass relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl p-4 text-left sm:p-5"
    >
      {/* A sliver of light that sweeps in from the left edge on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-accent/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[0.98rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {h.title}
        </h3>
        <span
          role="button"
          tabIndex={0}
          aria-label={saved ? `Remove ${h.title} from saved` : `Save ${h.title}`}
          aria-pressed={saved}
          title={saved ? "Saved — click to remove" : "Save for later"}
          onClick={(e) => {
            // The whole card is a button; without this the modal opens too.
            e.stopPropagation();
            onToggleSave();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave();
            }
          }}
          className={`-m-1 shrink-0 cursor-pointer rounded-lg p-1 text-base leading-none transition ${
            saved ? "text-accent" : "text-faint hover:text-accent"
          }`}
        >
          {saved ? "★" : "☆"}
        </span>
      </div>

      {h.tagline && <p className="line-clamp-2 text-sm leading-relaxed text-muted">{h.tagline}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {deadline && <Pill tone="urgent">{deadline}</Pill>}
        <Pill>{formatDates(h)}</Pill>
        <Pill>{where(h)}</Pill>
        {prize && <Pill>{prize}</Pill>}
        {h.domains.map((d) => (
          <Pill key={d} tone="topic">
            {topics.get(d) ?? d}
          </Pill>
        ))}
      </div>

      {h.idea_teaser && (
        <div className="mt-1 border-t border-white/6 pt-2.5">
          <p className="line-clamp-2 text-[0.82rem] font-medium leading-snug text-accent">
            <span className="mr-1 opacity-60">▸</span>
            {h.idea_teaser}
          </p>
          <p className="mt-1 text-[0.7rem] text-faint">
            {ideaCount === 1 ? "1 idea" : `+${ideaCount - 1} more ideas`}
            <span className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </p>
        </div>
      )}
    </button>
  );
}

function Control({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        active
          ? "border-accent/45 bg-accent/12 text-accent"
          : "border-white/8 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Hackathon | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    loadIndex()
      .then(setBundle)
      .catch((e) => setError(String(e)));
  }, []);

  // Favourites work signed out (stored in this browser) and merge into the account on sign-in,
  // so saving something is useful immediately and nothing is lost by signing in later.
  useEffect(() => {
    currentViewer().then(setViewer);
    return onViewerChange(setViewer);
  }, []);

  // A ref alongside the state: two quick clicks must compose, and reading `saved` from a closure
  // gave the second click a stale list that overwrote the first.
  const savedRef = useRef<string[]>([]);

  useEffect(() => {
    loadFavourites(viewer).then((list) => {
      savedRef.current = list;
      setSaved(list);
    });
  }, [viewer]);

  function toggleSaved(uid: string) {
    const next = toggle(savedRef.current, uid);
    savedRef.current = next;
    setSaved(next);
    writeLocal(next);
    void persistFavourite(uid, next.includes(uid), viewer);
  }

  const all = bundle?.hackathons ?? [];
  const shown = useMemo(() => applyFilters(all, filters, new Date(), saved), [all, filters, saved]);
  const urgentCount = useMemo(() => all.filter((h) => isUrgent(h)).length, [all]);
  const abroadCount = useMemo(() => all.filter(isKnownAbroad).length, [all]);
  const ideaTotal = useMemo(() => all.filter((h) => h.idea_count > 0).length, [all]);
  const topicLabels = useMemo(
    () => new Map((bundle?.domains ?? []).map((d) => [d.id, d.label])),
    [bundle],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Opening a card puts its own URL in the address bar, so a hackathon can be shared or
  // bookmarked from inside the app. A reload on that URL lands on the prerendered static page
  // that the build produced, which is also what search engines and link previews see.
  function open(h: Hackathon) {
    setSelected(h);
    if (h.slug) {
      window.history.pushState({ slug: h.slug }, "", `${import.meta.env.BASE_URL}h/${h.slug}/`);
    }
  }

  function close() {
    setSelected(null);
    // Use the history stack so the back button and the close button agree.
    if (window.history.state?.slug) window.history.back();
  }

  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <Header
        base={import.meta.env.BASE_URL}
        viewer={viewer}
        authEnabled={authConfigured}
        onSignIn={() => signInWithGitHub()}
        onSignOut={() => signOut()}
      />

      <Hero
        count={bundle?.count ?? 0}
        winners={675}
        topics={(bundle?.domains ?? []).length}
      />

      <main className="mx-auto max-w-5xl px-5 pb-20 sm:px-6">
        {/* Sticky so the filters stay reachable through a long list. */}
        <div className="sticky top-14 z-30 -mx-5 mb-5 border-b border-white/6 bg-surface/70 px-5 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search by name, city, theme or sponsor…"
              aria-label="Search hackathons"
              className="min-w-56 flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent/50 focus:bg-white/[0.05]"
            />
            <select
              value={filters.mode}
              onChange={(e) => set("mode", e.target.value as Mode | "all")}
              aria-label="Filter by mode"
              className="rounded-xl border border-white/8 bg-raised px-3 py-2 text-sm text-muted"
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
              className="rounded-xl border border-white/8 bg-raised px-3 py-2 text-sm text-muted"
            >
              <option value="all">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Control active={filters.onlyUrgent} onClick={() => set("onlyUrgent", !filters.onlyUrgent)}>
              Closing soon{urgentCount > 0 && ` (${urgentCount})`}
            </Control>
            <Control
              active={filters.hideAbroad}
              onClick={() => set("hideAbroad", !filters.hideAbroad)}
              title="Hides events we know are outside India. Listings with no country stay visible."
            >
              Skip abroad{abroadCount > 0 && ` (${abroadCount})`}
            </Control>
            {saved.length > 0 && (
              <Control
                active={filters.onlySaved}
                onClick={() => set("onlySaved", !filters.onlySaved)}
              >
                Saved ({saved.length})
              </Control>
            )}

          </div>
        </div>

        {bundle && bundle.domains.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            <Control active={filters.domain === "all"} onClick={() => set("domain", "all")}>
              All topics
            </Control>
            {bundle.domains.map((d) => (
              <Control
                key={d.id}
                active={filters.domain === d.id}
                onClick={() => set("domain", filters.domain === d.id ? "all" : d.id)}
              >
                {d.label}
                <span className="ml-1.5 tabular-nums opacity-50">{d.count}</span>
              </Control>
            ))}
          </div>
        )}

        {error && (
          <p className="glass rounded-2xl p-5 text-sm text-muted">
            Could not load hackathons: {error}
          </p>
        )}

        {!bundle && !error && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass h-36 animate-pulse rounded-2xl opacity-60" />
            ))}
          </div>
        )}

        {bundle && (
          <>
            <p className="mb-3 text-xs text-faint">
              {shown.length} of {all.length} hackathons
              {ideaTotal > 0 && ` · ${ideaTotal} with generated ideas`}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {shown.map((h) => (
                <Card
                key={h.uid}
                h={h}
                topics={topicLabels}
                onOpen={() => open(h)}
                saved={saved.includes(h.uid)}
                onToggleSave={() => toggleSaved(h.uid)}
              />
              ))}
            </div>

            {shown.length === 0 && (
              <p className="glass rounded-2xl p-8 text-center text-sm text-muted">
                Nothing matches those filters.
              </p>
            )}

            {selected && (
              <Detail
                hackathon={selected}
                topics={topicLabels}
                onClose={close}
              />
            )}

            <footer className="mt-14 border-t border-white/6 pt-5 text-xs leading-relaxed text-faint">
              Updated {new Date(bundle.generated_at).toLocaleString("en-IN")} · every listing
              links to the organiser's own page, where registration happens · aggregated from
              Devfolio, Unstop and MLH ·{" "}
              <a
                href="https://github.com/shipitdev/hackawon"
                className="underline transition hover:text-muted"
              >
                open source
              </a>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
