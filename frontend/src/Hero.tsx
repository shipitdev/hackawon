import { ArrowDown, ArrowRight } from "@phosphor-icons/react";
import { daysUntil, where } from "./lib";
import type { Hackathon } from "./types";

function daysLeft(h: Hackathon): string {
  const d = daysUntil(h.reg_deadline) ?? 0;
  return d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`;
}

/** Value proposition and the most time-sensitive real listings in one amber marquee. */
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
    <section className="hero-shell relative isolate overflow-hidden bg-hero text-hero-ink">
      <div aria-hidden className="deadline-terrain absolute inset-x-0 bottom-0 h-[42%] opacity-90" />

      <div className="relative mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-[90rem] content-center gap-6 px-4 py-6 sm:min-h-[calc(100svh-4rem)] sm:gap-8 sm:px-6 sm:py-12 md:grid-cols-12 lg:gap-16 lg:px-10 lg:py-16">
        <div className="min-w-0 text-center md:col-span-7 md:text-left lg:col-span-8">
          <h1
            className="rise text-[clamp(2.5rem,6.4vw,6.5rem)] font-light leading-[0.88] tracking-[-0.075em] md:text-[clamp(2.5rem,5vw,6.5rem)] lg:text-[clamp(2.5rem,6.4vw,6.5rem)]"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span className="block">Find the hackathon.</span>
            <span className="block">Build the winner.</span>
          </h1>

          <p
            className="rise mx-auto mt-6 max-w-[38ch] text-base leading-relaxed text-hero-ink/75 sm:text-lg md:mx-0"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Open events and grounded project ideas, collected for builders who want a sharper start.
          </p>

          <a
            href="#list"
            className="rise press group mt-6 inline-flex min-h-11 items-center gap-3 rounded bg-hero-ink px-5 py-3 text-sm font-medium text-hero sm:mt-8"
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

          <dl
            className="rise mt-8 grid max-w-2xl grid-cols-3 border-t border-hero-ink/35 text-left sm:mt-10"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            {[
              ["Open events", count],
              ["Winner references", winners],
              ["Urgent deadlines", closingTotal],
            ].map(([label, value], index) => (
              <div key={label} className={index ? "border-l border-hero-ink/25 px-3 py-3 sm:px-5" : "py-3 pr-3 sm:pr-5"}>
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-hero-ink/65">{label}</dt>
                <dd className="mt-1 font-mono text-xl tabular-nums sm:text-2xl">
                  {Number(value).toLocaleString("en-IN")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          aria-labelledby="closing-heading"
          className="deadline-panel rise min-w-0 self-center text-left md:col-span-5 lg:col-span-4"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-hero-ink/15 px-5 py-4">
            <h2 id="closing-heading" className="text-sm font-semibold tracking-[-0.015em]">
              Registration deadlines
            </h2>
            {closingTotal > 0 && (
              <span className="rounded-full bg-hero-ink/8 px-2.5 py-1 font-mono text-[0.65rem] tabular-nums text-hero-ink/75">{closingTotal} this week</span>
            )}
          </div>

          {loading ? (
            <ul aria-hidden className="px-3 max-lg:[&>li:nth-child(n+4)]:hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex min-h-16 items-center gap-4 border-b border-hero-ink/10 px-2 py-3 last:border-b-0">
                  <span className="h-3 w-12 animate-pulse rounded bg-hero-detail/55" />
                  <span className="h-3 flex-1 animate-pulse rounded bg-hero-detail/40" />
                </li>
              ))}
            </ul>
          ) : closing.length === 0 ? (
            <p className="px-5 py-6 text-sm leading-relaxed text-hero-ink/75">
              Nothing closes in the next seven days. The full index below has everything still open.
            </p>
          ) : (
            <ul className="px-3 max-lg:[&>li:nth-child(n+4)]:hidden">
              {closing.map((h) => (
                <li key={h.uid} className="border-b border-hero-ink/10 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpen(h)}
                    className="press group grid min-h-16 w-full grid-cols-[3.5rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-hero-ink/6"
                  >
                    <span className="rounded-md bg-hero-ink/8 py-1.5 text-center font-mono text-[0.65rem] font-medium tabular-nums">{daysLeft(h)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{h.title}</span>
                      <span className="mt-1 block truncate text-xs text-hero-ink/70">{where(h)}</span>
                    </span>
                    <ArrowRight
                      size={14}
                      aria-hidden
                      className="text-hero-ink/55 transition-transform group-hover:translate-x-0.5"
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
              className={`${closingTotal > closing.length ? "" : "lg:hidden"} press min-h-12 w-full border-t border-hero-ink/15 px-5 py-3 text-left text-xs font-medium text-hero-ink/75 hover:bg-hero-ink/6 hover:text-hero-ink`}
            >
              Show all {closingTotal} in the index
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
