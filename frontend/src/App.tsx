import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, MagnifyingGlass, Star } from "@phosphor-icons/react";
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
  SOURCE_LABELS,
  where,
  type Filters,
} from "./lib";

const MODES: { value: Mode | "all"; label: string }[] = [
  { value: "all", label: "Anywhere" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
];

function Row({
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
  const topicText = h.domains
    .slice(0, 2)
    .map((d) => topics.get(d) ?? d)
    .join(", ");

  return (
    <article className="reveal group relative grid gap-x-8 gap-y-2 rounded-2xl px-4 py-4 transition-colors hover:bg-raised has-[h3_button:focus-visible]:bg-raised has-[h3_button:focus-visible]:outline-2 has-[h3_button:focus-visible]:outline-accent md:grid-cols-[8rem_minmax(0,1fr)] md:px-5 md:py-5 lg:grid-cols-[9.5rem_minmax(0,1fr)_12rem]">
      <div className="flex flex-wrap gap-x-3 pr-10 font-mono text-xs leading-5 tabular-nums md:block md:pr-0 md:pt-0.5">
        <p className="text-muted">{formatDates(h)}</p>
        {deadline && <p className="font-medium text-accent">{deadline}</p>}
      </div>

      <div className="min-w-0 md:pr-10 lg:pr-0">
        <h3 className="text-base font-semibold leading-snug tracking-[-0.015em] text-ink">
          {/* The title is the row's one real button; `after:` stretches its hit area over the
              whole row, so the save button beside it is a sibling rather than nested inside. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {h.title}
          </button>
        </h3>
        {h.tagline && <p className="mt-1 line-clamp-1 text-sm text-muted">{h.tagline}</p>}
        {h.idea_teaser && (
          <p className="mt-3 flex items-start gap-2 text-sm leading-snug">
            <Lightbulb size={16} weight="duotone" aria-hidden className="mt-px shrink-0 text-accent" />
            <span className="line-clamp-2 md:line-clamp-1">
              {h.idea_teaser}
              {h.idea_count > 1 && (
                <span className="text-faint"> and {h.idea_count - 1} more ideas</span>
              )}
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted md:col-start-2 lg:col-start-auto lg:flex-col lg:items-end lg:gap-1 lg:pr-9 lg:text-right">
        <span className="line-clamp-2">{where(h)}</span>
        {prize && <span className="font-mono tabular-nums text-ink">{prize}</span>}
        {topicText && <span className="text-xs text-faint">{topicText}</span>}
      </div>

      <button
        type="button"
        onClick={onToggleSave}
        aria-label={saved ? `Remove ${h.title} from saved` : `Save ${h.title}`}
        aria-pressed={saved}
        title={saved ? "Saved. Click to remove" : "Save for later"}
        className={`press absolute right-3 top-4 z-10 rounded-lg p-2 md:right-4 ${
          saved ? "text-accent" : "text-faint hover:bg-sunken hover:text-ink"
        }`}
      >
        <Star size={18} weight={saved ? "fill" : "regular"} aria-hidden />
      </button>
    </article>
  );
}

function Chip({
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
      className={`press shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm ${
        active
          ? "border-ink bg-ink text-surface"
          : "border-line bg-raised text-muted hover:border-ink/25 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// 16px below `sm`: iOS Safari zooms the page in on focus for anything smaller.
const selectClass =
  "min-w-0 flex-1 rounded-lg border border-line bg-raised py-2 pl-2.5 pr-2 text-base text-ink transition-colors hover:border-ink/25 sm:flex-none sm:px-3 sm:text-sm";

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
  const urgent = useMemo(
    () =>
      all
        .filter((h) => isUrgent(h))
        .sort((a, b) => (a.reg_deadline ?? "").localeCompare(b.reg_deadline ?? "")),
    [all],
  );
  const abroadCount = useMemo(() => all.filter(isKnownAbroad).length, [all]);
  const ideaTotal = useMemo(() => all.filter((h) => h.idea_count > 0).length, [all]);
  const topicLabels = useMemo(
    () => new Map((bundle?.domains ?? []).map((d) => [d.id, d.label])),
    [bundle],
  );
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Opening a row puts its own URL in the address bar, so a hackathon can be shared or
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
      <a
        href="#list"
        className="sr-only rounded-lg bg-ink px-3 py-2 text-sm text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
      >
        Skip to hackathons
      </a>

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
        closing={urgent.slice(0, 5)}
        closingTotal={urgent.length}
        loading={!bundle && !error}
        onOpen={open}
        onSeeClosing={() => {
          set("onlyUrgent", true);
          document.getElementById("list")?.scrollIntoView();
        }}
      />

      <main id="list" className="scroll-mt-14">
        {/* Sticky so the filters stay reachable through a long list, where there is room for it. */}
        <div className="z-30 border-y border-line bg-surface/85 backdrop-blur-xl roomy:sticky roomy:top-14">
          <div className="mx-auto max-w-6xl space-y-2.5 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <label className="relative w-full min-w-0 sm:w-auto sm:flex-1">
                <span className="sr-only">Search hackathons</span>
                <MagnifyingGlass
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => set("query", e.target.value)}
                  placeholder="Search name, city, sponsor"
                  className="w-full rounded-lg border border-line bg-raised py-2 pl-9 pr-3 text-base text-ink transition-colors placeholder:text-faint hover:border-ink/25 focus:border-accent focus:outline-none sm:text-sm"
                />
              </label>
              <select
                value={filters.mode}
                onChange={(e) => set("mode", e.target.value as Mode | "all")}
                aria-label="Filter by mode"
                className={selectClass}
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
                className={selectClass}
              >
                <option value="all">All sources</option>
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <Chip active={filters.onlyUrgent} onClick={() => set("onlyUrgent", !filters.onlyUrgent)}>
                Closing soon
                {urgent.length > 0 && (
                  <span className="ml-1.5 font-mono text-xs tabular-nums opacity-60">{urgent.length}</span>
                )}
              </Chip>
              <Chip
                active={filters.hideAbroad}
                onClick={() => set("hideAbroad", !filters.hideAbroad)}
                title="Hides events we know are outside India. Listings with no country stay visible."
              >
                Skip abroad
                {abroadCount > 0 && (
                  <span className="ml-1.5 font-mono text-xs tabular-nums opacity-60">{abroadCount}</span>
                )}
              </Chip>
              {saved.length > 0 && (
                <Chip active={filters.onlySaved} onClick={() => set("onlySaved", !filters.onlySaved)}>
                  Saved
                  <span className="ml-1.5 font-mono text-xs tabular-nums opacity-60">{saved.length}</span>
                </Chip>
              )}
              {bundle && bundle.domains.length > 0 && (
                <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-line" />
              )}
              {bundle?.domains.map((d) => (
                <Chip
                  key={d.id}
                  active={filters.domain === d.id}
                  onClick={() => set("domain", filters.domain === d.id ? "all" : d.id)}
                >
                  {d.label}
                  <span className="ml-1.5 font-mono text-xs tabular-nums opacity-60">{d.count}</span>
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <h2 className="sr-only">All hackathons</h2>

          {error && (
            <div className="rounded-2xl border border-line bg-raised p-6">
              <p className="font-medium">Could not load hackathons.</p>
              <p className="mt-1 font-mono text-xs text-muted">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="press mt-4 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink/25"
              >
                Reload
              </button>
            </div>
          )}

          {!bundle && !error && (
            <div aria-hidden className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="grid gap-x-8 gap-y-3 px-4 py-4 md:grid-cols-[8rem_1fr] md:px-5 md:py-5 lg:grid-cols-[9.5rem_1fr_12rem]"
                >
                  <span className="h-4 w-24 animate-pulse rounded bg-sunken" />
                  <span className="space-y-2">
                    <span className="block h-4 w-2/3 animate-pulse rounded bg-sunken" />
                    <span className="block h-3 w-1/2 animate-pulse rounded bg-sunken" />
                  </span>
                  <span className="hidden h-4 w-20 animate-pulse justify-self-end rounded bg-sunken lg:block" />
                </div>
              ))}
            </div>
          )}

          {bundle && (
            <>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1 text-sm text-muted">
                <p>
                  <span className="font-mono tabular-nums text-ink">{shown.length}</span> of{" "}
                  <span className="font-mono tabular-nums">{all.length}</span> hackathons
                  {ideaTotal > 0 && (
                    <span className="text-faint">, {ideaTotal} with project ideas</span>
                  )}
                </p>
                {filtered && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-sm text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="-mx-4 md:-mx-5">
                {shown.map((h) => (
                  <Row
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
                <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
                  <p className="font-medium">Nothing matches those filters.</p>
                  <p className="mt-1 text-sm text-muted">
                    Try a broader search, or clear the filters to see all {all.length}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="press mt-5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface hover:bg-ink/85"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {selected && <Detail hackathon={selected} topics={topicLabels} onClose={close} />}

              <footer className="mt-20 flex flex-col gap-2 border-t border-line pt-6 text-xs leading-relaxed text-faint sm:flex-row sm:justify-between">
                <p className="max-w-[60ch]">
                  Aggregated from Devfolio, Unstop and MLH. Registration always happens on the
                  organiser's own page. Updated{" "}
                  {new Date(bundle.generated_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  .
                </p>
                <a
                  href="https://github.com/shipitdev/hackawon"
                  className="underline decoration-line underline-offset-4 transition-colors hover:text-ink"
                >
                  Open source on GitHub
                </a>
              </footer>
            </>
          )}
        </div>
      </main>
    </>
  );
}
