import { ArrowLeft } from "@phosphor-icons/react";
import { HackathonDetail } from "./HackathonDetail";
import { Wordmark } from "./Header";
import { buildPrompt } from "./lib";
import type { Domain, Hackathon, IdeaSet } from "./types";

/**
 * The standalone page at `/h/<slug>`, rendered to static HTML at build time.
 *
 * Deliberately ships **no JavaScript**. The content is text, so a static page is faster, cannot
 * break, and is what search engines and link previews read. The one interactive feature, copying
 * a prompt, is provided as a selectable block inside a `<details>` element instead of a button
 * that would need a bundle to work.
 */
export function DetailPage({
  hackathon,
  set,
  domains,
  base,
}: {
  hackathon: Hackathon;
  set: IdeaSet | null;
  domains: Domain[];
  base: string;
}) {
  const topics = new Map(domains.map((d) => [d.id, d.label]));
  const prompt = buildPrompt(hackathon, set?.exemplars ?? []);

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Wordmark base={base} />
          <a
            href={base}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden /> All hackathons
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="mb-8">
          <h1 className="text-[clamp(1.9rem,5vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-balance">
            {hackathon.title}
          </h1>
          {hackathon.tagline && (
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted sm:text-lg">
              {hackathon.tagline}
            </p>
          )}
        </div>

        <HackathonDetail hackathon={hackathon} set={set} topics={topics} />

        <details className="group mt-10 rounded-2xl border border-line bg-raised">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Prompt for your own AI
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Paste it into ChatGPT or Gemini, then add your skills and how long you have.
            </span>
          </summary>
          <pre className="mx-5 mb-5 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-sunken p-4 font-mono text-xs leading-relaxed text-muted">
            {prompt}
          </pre>
        </details>

        <footer className="mt-14 border-t border-line pt-6 text-xs leading-relaxed text-faint">
          Registration happens on the organiser's own page, linked above. Ideas are generated from
          past winning projects, so treat them as starting points, not predictions.{" "}
          <a href={base} className="underline decoration-line underline-offset-4 hover:text-ink">
            Browse every open hackathon
          </a>
          .
        </footer>
      </main>
    </>
  );
}
