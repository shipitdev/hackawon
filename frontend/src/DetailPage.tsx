import { HackathonDetail } from "./HackathonDetail";
import { buildPrompt } from "./lib";
import type { Domain, Hackathon, IdeaSet } from "./types";

/**
 * The standalone page at `/h/<slug>`, rendered to static HTML at build time.
 *
 * Deliberately ships **no JavaScript**. The content is text, so a static page is faster, cannot
 * break, and is what search engines and link previews read. The one interactive feature — copying
 * a prompt — is provided as a selectable block inside a `<details>` element instead of a button
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
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <a
        href={base}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-accent"
      >
        <span aria-hidden>←</span> All hackathons
      </a>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-3xl">
          {hackathon.title}
        </h1>
        {hackathon.tagline && (
          <p className="mt-2 text-base leading-relaxed text-muted">{hackathon.tagline}</p>
        )}
      </header>

      <HackathonDetail hackathon={hackathon} set={set} topics={topics} />

      <details className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Prompt for your own AI — copy this into ChatGPT or Gemini
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Already filled in with this hackathon's tracks, sponsors and the past winners it
          resembles. Add your skills and how long you have.
        </p>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-muted">
          {prompt}
        </pre>
      </details>

      <footer className="mt-10 border-t border-white/6 pt-5 text-xs leading-relaxed text-faint">
        Registration happens on the organiser's own page, linked above. Ideas are generated and
        grounded in past winning projects — treat them as starting points, not predictions.{" "}
        <a href={base} className="underline transition hover:text-muted">
          Browse every open hackathon
        </a>
        .
      </footer>
    </div>
  );
}
