import { Suspense, lazy, useEffect, useRef, useState } from "react";

const LiquidHero = lazy(() => import("./LiquidHero"));

/**
 * Decides whether this device should get the shader at all, and never lets that decision hold up
 * the page. The CSS gradient below is what everyone sees first; WebGL fades in over it.
 */
function useWantsShader(): boolean {
  const [wants, setWants] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // `saveData` is on by default for a lot of Indian mobile users — respect it.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const thrifty = connection?.saveData === true;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;

    let webgl = false;
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }

    if (reduced || thrifty || weak || !webgl) return;

    // Wait for the browser to go quiet so the shader never competes with first paint.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(() => setWants(true));
    return () => window.clearTimeout(handle as number);
  }, []);

  return wants;
}

export function Hero({
  count,
  winners,
  topics,
}: {
  count: number;
  winners: number;
  topics: number;
}) {
  const wantsShader = useWantsShader();
  const [lit, setLit] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!wantsShader) return;
    // A timer, not requestAnimationFrame: rAF never fires while a tab is in the background, which
    // would leave the canvas stuck at opacity 0 for anyone who opens the site in a new tab.
    const id = window.setTimeout(() => setLit(true), 80);
    return () => window.clearTimeout(id);
  }, [wantsShader]);

  // Stop animating once the hero scrolls away — a GPU running a full-screen shader nobody can
  // see is pure battery drain, and phones are where this gets read.
  useEffect(() => {
    const node = section.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin: "120px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={section} className="relative isolate overflow-hidden">
      {/* Static fallback: a plausible frozen frame of the shader, so the layout never flashes. */}
      <div aria-hidden className="absolute inset-0 bg-hero-fallback" />

      {wantsShader && (
        <Suspense fallback={null}>
          <div
            aria-hidden
            className={`absolute inset-0 transition-opacity duration-1000 ${lit ? "opacity-100" : "opacity-0"}`}
          >
            <LiquidHero paused={!onScreen} />
          </div>
        </Suspense>
      )}

      {/* Fade the canvas into the page background so the hero has no hard edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface"
      />

      <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Updated every 6 hours
        </p>

        <h1 className="max-w-3xl text-[clamp(2.6rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-white">
          Find the hackathon.
          <br />
          <span className="bg-gradient-to-r from-white via-white to-white/55 bg-clip-text text-transparent">
            Build the{" "}
          </span>
          <em className="text-liquid font-serif italic">winner</em>
          <span className="text-white">.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
          Every open hackathon in one place, each with project ideas grounded in what has
          actually won before.
        </p>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
          {[
            { n: count, label: "open hackathons" },
            { n: winners, label: "winning projects studied" },
            { n: topics, label: "topics" },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-semibold tabular-nums text-white text-[clamp(1.5rem,3.2vw,2rem)] leading-none tracking-tight">
                {stat.n.toLocaleString("en-IN")}
              </dd>
              <p className="mt-1.5 text-xs uppercase tracking-[0.14em] text-white/45">
                {stat.label}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
