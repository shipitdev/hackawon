import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import { Wordmark } from "./Header";
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
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Wordmark base={base} />
          <a
            href={base}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden /> All hackathons
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-[clamp(2.2rem,5.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-balance">
              The hackathon toolkit
            </h1>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">
              {data.count} things worth knowing before the clock starts: model credits, auth,
              hosting, and slides that do not look like a school project.
            </p>
          </div>

          <aside className="self-end border-l-2 border-accent pl-4 md:col-span-5">
            <p className="text-sm font-semibold">This list is early and incomplete.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Know something better, or spot something that changed?{" "}
              <a
                href="https://github.com/shipitdev/hackawon/blob/main/data/tools.yml"
                className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
              >
                Edit <code className="font-mono text-xs">data/tools.yml</code>
              </a>
              . It is one file and a pull request.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Free tiers change without warning. Entries unchecked for {data.stale_after_days} days
              are marked, so confirm current limits before relying on one.
            </p>
          </aside>
        </div>

        {data.categories.map((category) => (
          <section key={category.id} className="mt-16">
            <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-[-0.02em]">
              {category.label}
              <span className="font-mono text-xs font-normal tabular-nums text-faint">
                {category.tools.length}
              </span>
            </h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {category.tools.map((tool) => (
                <li
                  key={tool.name}
                  className="group relative flex flex-col rounded-2xl border border-line bg-raised p-5 transition-colors hover:border-ink/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold tracking-[-0.015em] after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {tool.name}
                    </a>
                    <ArrowUpRight
                      size={16}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-muted">{tool.what_you_get}</p>

                  {tool.caveat && (
                    <p className="mt-2 text-sm leading-relaxed text-faint">
                      <span className="font-medium text-muted">Watch out: </span>
                      {tool.caveat}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-xs">
                    <span className="font-mono tabular-nums text-faint">checked {tool.checked}</span>
                    {!tool.free && (
                      <span className="rounded-md border border-line px-1.5 py-0.5 text-muted">
                        Paid
                      </span>
                    )}
                    {tool.stale && (
                      <span className="rounded-md border border-accent/40 px-1.5 py-0.5 text-accent">
                        May be out of date
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="mt-20 border-t border-line pt-6 text-xs leading-relaxed text-faint">
          No affiliate links and nothing sponsored. These are listed because they are useful.{" "}
          <a href={base} className="underline decoration-line underline-offset-4 hover:text-ink">
            Back to the hackathons
          </a>
          .
        </footer>
      </main>
    </>
  );
}
