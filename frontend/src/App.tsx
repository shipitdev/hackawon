import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Detail } from "./Detail";
import { HackathonCard } from "./HackathonCard";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { authConfigured, currentViewer, onViewerChange, signInWithGitHub, signOut } from "./auth";
import type { Viewer } from "./auth";
import { loadFavourites, persistFavourite, toggle, writeLocal } from "./favourites";
import { loadIndex } from "./data";
import type { Bundle, Hackathon, Mode } from "./types";
import {
  applyFilters,
  EMPTY_FILTERS,
  isKnownAbroad,
  isUrgent,
  SOURCE_LABELS,
  type Filters,
} from "./lib";

const MODES: { value: Mode | "all"; label: string }[] = [
  { value: "all", label: "Anywhere" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
];

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
      className={`press min-h-11 shrink-0 whitespace-nowrap rounded border px-3 py-2 text-sm ${
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
  "min-h-11 min-w-0 w-full rounded border border-line bg-raised px-3 py-2 text-base text-ink transition-colors hover:border-ink/50 sm:text-sm";

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
  const activeSaved = useMemo(() => {
    const available = new Set(all.map((h) => h.uid));
    return saved.filter((uid) => available.has(uid));
  }, [all, saved]);
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
        className="sr-only rounded bg-ink px-3 py-2 text-sm text-surface focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
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

      <main id="list" className="scroll-mt-14 bg-surface sm:scroll-mt-16">
        {/* Sticky so the filters stay reachable through a long list, where there is room for it. */}
        <div className="z-30 border-b border-line bg-surface/90 backdrop-blur-xl roomy:sticky roomy:top-16">
          <div className="mx-auto max-w-[90rem] px-4 py-4 sm:px-6 lg:px-10 lg:py-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem] md:gap-4">
              <label className="col-span-2 block min-w-0 md:col-span-1">
                <span className="mb-2 block font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-faint">Search</span>
                <span className="relative block">
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
                  className="min-h-11 w-full rounded border border-line bg-raised py-2 pl-9 pr-3 text-base text-ink transition-colors placeholder:text-faint hover:border-ink/50 focus:border-accent focus:outline-none sm:text-sm"
                />
                </span>
              </label>
              <label>
                <span className="mb-2 block font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-faint">Mode</span>
                <select
                  value={filters.mode}
                  onChange={(e) => set("mode", e.target.value as Mode | "all")}
                  className={selectClass}
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-faint">Source</span>
                <select
                  value={filters.source}
                  onChange={(e) => set("source", e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All sources</option>
                  {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="hidden shrink-0 font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-faint sm:inline">Browse by</span>
              <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
              {activeSaved.length > 0 && (
                <Chip active={filters.onlySaved} onClick={() => set("onlySaved", !filters.onlySaved)}>
                  Saved
                  <span className="ml-1.5 font-mono text-xs tabular-nums opacity-60">{activeSaved.length}</span>
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
        </div>

        <div className="mx-auto max-w-[90rem] px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pt-10">
          <h2 className="sr-only">All hackathons</h2>

          {error && (
            <div className="border-y border-line bg-raised px-4 py-8 sm:px-6">
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-accent">Load error</p>
              <p className="font-medium">Could not load hackathons.</p>
              <p className="mt-1 font-mono text-xs text-muted">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="press mt-4 min-h-11 rounded border border-line px-4 py-2 text-sm hover:border-ink/50"
              >
                Reload
              </button>
            </div>
          )}

          {!bundle && !error && (
            <div aria-hidden className="catalogue-grid grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-12 xl:p-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`min-h-72 border border-line bg-raised p-5 sm:p-6 ${
                    i % 4 === 0 || i % 4 === 3 ? "xl:col-span-7" : "xl:col-span-5"
                  }`}
                >
                  <span className="block h-3 w-28 animate-pulse rounded bg-sunken" />
                  <span className="mt-8 block h-9 w-3/4 animate-pulse rounded bg-sunken" />
                  <span className="mt-3 block h-3 w-full animate-pulse rounded bg-sunken" />
                  <span className="mt-2 block h-3 w-4/5 animate-pulse rounded bg-sunken" />
                </div>
              ))}
            </div>
          )}

          {bundle && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-1 pb-4 text-sm text-muted">
                <p>
                  <span className="mr-3 font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-faint">Discovery index</span>
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

              <div className="catalogue-grid mt-4 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-12 xl:p-8">
                {shown.map((h, index) => (
                  <HackathonCard
                    key={h.uid}
                    h={h}
                    index={index}
                    topics={topicLabels}
                    onOpen={() => open(h)}
                    saved={saved.includes(h.uid)}
                    onToggleSave={() => toggleSaved(h.uid)}
                  />
                ))}
              </div>

              {shown.length === 0 && (
                <div className="border-b border-line px-6 py-16 text-center">
                  <p className="font-medium">Nothing matches those filters.</p>
                  <p className="mt-1 text-sm text-muted">
                    Try a broader search, or clear the filters to see all {all.length}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="press mt-5 min-h-11 rounded bg-ink px-4 py-2 text-sm font-medium text-surface hover:bg-ink/85"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {selected && <Detail hackathon={selected} topics={topicLabels} onClose={close} />}

              <footer className="mt-20 flex flex-col gap-4 border-t border-line py-8 font-mono text-xs leading-relaxed text-faint sm:flex-row sm:justify-between">
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
