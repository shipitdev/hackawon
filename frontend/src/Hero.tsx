import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import { daysUntil, where } from "./lib";
import type { Hackathon } from "./types";

function daysLeft(h: Hackathon): string {
  const d = daysUntil(h.reg_deadline) ?? 0;
  return d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`;
}

/**
 * Value proposition on the left, the most time-sensitive real listings on the right.
 *
 * The right panel is the hero's visual on purpose: for a student the most useful thing on the
 * page is "what closes this week", so it is shown before anything else rather than illustrated.
 */
export function Hero({
  count,
  winners,
  closing,
  closingTotal,
  loading,
  onOpen,
  onSeeClosing,
}: {
  count: number;
  winners: number;
  closing: Hackathon[];
  closingTotal: number;
  loading: boolean;
  onOpen: (h: Hackathon) => void;
  onSeeClosing: () => void;
}) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 md:grid-cols-2 md:pb-16 md:pt-16 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        <h1
          className="rise max-w-[14ch] text-[clamp(2rem,6.2vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-balance"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          Find the hackathon. Build the <span className="text-accent">winner</span>.
        </h1>

        <p
          className="rise mt-4 max-w-[46ch] sm:mt-5 text-pretty text-base leading-relaxed text-muted sm:text-lg"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Open hackathons from Devfolio, Unstop and MLH, each with project ideas grounded in{" "}
          {winners.toLocaleString("en-IN")} past winners.
        </p>

        <a
          href="#list"
          className="rise press group mt-6 inline-flex sm:mt-8 items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-surface hover:bg-ink/85"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Browse {count > 0 ? count.toLocaleString("en-IN") : ""} hackathons
          <ArrowDown
            size={15}
            weight="bold"
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-y-0.5"
          />
        </a>
      </div>

      <aside
        aria-labelledby="closing-heading"
        className="rise min-w-0 rounded-2xl border border-line bg-raised p-2 shadow-[0_24px_60px_-32px_oklch(0.3_0.02_286/0.35)] lg:col-span-5"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <div className="flex items-baseline justify-between px-3 pb-2 pt-3">
          <h2 id="closing-heading" className="text-sm font-semibold">
            Registration closing soon
          </h2>
          {closingTotal > 0 && (
            <span className="font-mono text-xs tabular-nums text-faint">{closingTotal} this week</span>
          )}
        </div>

        {loading ? (
          <ul aria-hidden className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 rounded-xl px-3 py-3">
                <span className="h-4 w-12 animate-pulse rounded bg-sunken" />
                <span className="h-4 flex-1 animate-pulse rounded bg-sunken" />
              </li>
            ))}
          </ul>
        ) : closing.length === 0 ? (
          <p className="px-3 pb-4 pt-1 text-sm leading-relaxed text-muted">
            Nothing closes in the next seven days. The full list below has everything still open.
          </p>
        ) : (
          // Three on a phone keeps the list below within reach; "Show all" covers the rest.
          <ul className="space-y-0.5 max-sm:[&>li:nth-child(n+4)]:hidden">
            {closing.map((h) => (
              <li key={h.uid}>
                <button
                  type="button"
                  onClick={() => onOpen(h)}
                  className="press group flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-sunken"
                >
                  <span className="w-14 shrink-0 font-mono text-sm font-medium tabular-nums text-accent">
                    {daysLeft(h)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.title}</span>
                    <span className="block truncate text-xs text-faint">{where(h)}</span>
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {closingTotal > Math.min(closing.length, 3) && (
          <button
            type="button"
            onClick={onSeeClosing}
            className={`${closingTotal > closing.length ? "" : "sm:hidden"} mt-1 w-full border-t border-line px-3 pb-2 pt-3 text-left text-sm text-muted transition-colors hover:text-ink`}
          >
            Show all {closingTotal} in the list
          </button>
        )}
      </aside>
    </section>
  );
}
