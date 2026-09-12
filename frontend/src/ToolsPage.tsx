import type { ToolsBundle } from "./types";

/**
 * The toolkit at `/tools`, rendered to static HTML at build time.
 *
 * Says plainly that it is incomplete. A half-empty list that admits it invites contributions; one
 * that pretends to be authoritative just looks wrong. Each entry shows when a human last checked
 * it, because free tiers change constantly and a confident dead link is worse than no link.
 */
export function ToolsPage({ data, base }: { data: ToolsBundle; base: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <a
        href={base}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-accent"
      >
        <span aria-hidden>←</span> All hackathons
      </a>

      <header className="mb-6">
        <h1 className="text-[clamp(1.9rem,5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
          The hackathon toolkit
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          {data.count} things worth knowing about before the clock starts: where to get model
          credits, what to build auth on, how to make slides that do not look like a school
          project.
        </p>
      </header>

      <div className="mb-8 rounded-2xl border border-accent/25 bg-accent/[0.07] p-4">
        <p className="text-sm font-semibold text-ink">This list is early and incomplete.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          It is a starting point, not a survey. If you know something better — or spot something
          here that has changed —{" "}
          <a
            href="https://github.com/shipitdev/hackawon/blob/main/data/tools.yml"
            className="underline transition hover:text-accent"
          >
            add it to <code className="text-xs">data/tools.yml</code>
          </a>
          . It is one file and a pull request.
        </p>
      </div>

      <p className="mb-8 text-xs leading-relaxed text-faint">
        Free tiers change without warning. Each entry shows the date a human last checked it, and
        anything unchecked for {data.stale_after_days} days is marked as possibly out of date.
        Always confirm the current limits before you rely on one.
      </p>

      {data.categories.map((category) => (
        <section key={category.id} className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-faint">
            {category.label}
          </h2>
          <ul className="space-y-2.5">
            {category.tools.map((tool) => (
              <li
                key={tool.name}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition hover:border-white/16"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold tracking-[-0.01em] text-ink underline decoration-white/20 underline-offset-4 transition hover:decoration-accent"
                  >
                    {tool.name}
                  </a>
                  {!tool.free && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.68rem] text-amber-300">
                      paid
                    </span>
                  )}
                  {tool.stale && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.68rem] text-faint">
                      may be out of date
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-sm leading-relaxed text-muted">{tool.what_you_get}</p>

                {tool.caveat && (
                  <p className="mt-1.5 text-sm leading-relaxed text-faint">
                    <span className="font-medium">Watch out: </span>
                    {tool.caveat}
                  </p>
                )}

                <p className="mt-2 text-[0.68rem] text-faint">checked {tool.checked}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="border-t border-white/6 pt-5 text-xs leading-relaxed text-faint">
        No affiliate links and nothing sponsored — these are listed because they are useful.{" "}
        <a href={base} className="underline transition hover:text-muted">
          Back to the hackathons
        </a>
        .
      </footer>
    </div>
  );
}
