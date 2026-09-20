import { ArrowUpRight, Clock, Trophy } from "@phosphor-icons/react";
import type { Hackathon, IdeaSet } from "./types";
import { formatDates, formatPrize, SOURCE_LABELS, where } from "./lib";

function Tag({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
        accent ? "border-accent/40 text-accent" : "border-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Everything known about one hackathon, as markup.
 *
 * Purely presentational: no fetching, no dialog chrome, no state. Both consumers render this, so
 * the sheet and the prerendered `/h/<slug>` page cannot drift apart:
 *
 *   Detail.tsx     sheet, fetches the ideas, wraps this in dialog chrome
 *   DetailPage.tsx standalone page, data passed in at build time by the prerenderer
 */
export function HackathonDetail({
  hackathon,
  set,
  topics,
  loading = false,
  failed = false,
  copySlot,
}: {
  hackathon: Hackathon;
  set: IdeaSet | null;
  topics: Map<string, string>;
  loading?: boolean;
  failed?: boolean;
  /** The "Copy prompt" button, which needs client-side clipboard access. */
  copySlot?: React.ReactNode;
}) {
  const ideas = set?.ideas ?? [];
  const exemplars = set?.exemplars ?? [];
  const byUid = new Map(exemplars.map((e) => [e.uid, e]));

  const facts = [
    { label: "When", value: formatDates(hackathon) },
    { label: "Where", value: where(hackathon) },
    { label: "Prize pool", value: formatPrize(hackathon) },
    { label: "Team size", value: hackathon.team_max ? `Up to ${hackathon.team_max}` : null },
  ].filter((f) => f.value);

  return (
    <>
      <dl className="flex flex-wrap gap-x-10 gap-y-4">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-faint">{f.label}</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      {hackathon.domains.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {hackathon.domains.map((d) => (
            <Tag key={d}>{topics.get(d) ?? d}</Tag>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={hackathon.url}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent hover:brightness-110"
        >
          Apply on {SOURCE_LABELS[hackathon.source] ?? hackathon.source}
          <ArrowUpRight size={15} weight="bold" aria-hidden />
        </a>
        {copySlot}
      </div>

      {hackathon.tracks.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold">Prize tracks</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hackathon.tracks.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </section>
      )}

      {hackathon.problem_sources.length > 0 && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold">Problem statements</h3>
          <div className="mt-3 space-y-3">
            {hackathon.problem_sources.map((source, index) => (
              <div key={`${source.url ?? source.title}-${index}`} className="border-l-2 border-line pl-3">
                {source.text && (
                  <p className="line-clamp-6 max-w-[70ch] text-sm leading-relaxed text-muted">
                    {source.text}
                  </p>
                )}
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-ink underline decoration-line underline-offset-2 hover:decoration-accent"
                  >
                    {source.title || "Open problem statement"}
                    <ArrowUpRight size={13} weight="bold" aria-hidden />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          Project ideas
          {hackathon.idea_count > 0 && (
            <span className="font-mono text-xs font-normal tabular-nums text-faint">
              {hackathon.idea_count}
            </span>
          )}
        </h3>

        {loading && (
          <div aria-hidden className="mt-4 space-y-3">
            {Array.from({ length: Math.min(hackathon.idea_count, 3) }).map((_, i) => (
              <div key={i} className="space-y-2.5 rounded-2xl border border-line p-5">
                <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
                <div className="h-3 w-full animate-pulse rounded bg-sunken" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-sunken" />
              </div>
            ))}
          </div>
        )}

        {failed && (
          <p className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-muted">
            Could not load the ideas for this one. The Copy AI prompt button above still works.
          </p>
        )}

        {!loading && !failed && ideas.length === 0 && (
          <p className="mt-4 rounded-2xl border border-dashed border-line p-5 text-sm leading-relaxed text-muted">
            No ideas generated for this one yet. Copy AI prompt gives you a ready-made prompt with
            this hackathon's tracks and sponsors filled in.
          </p>
        )}

        {set?.grounding?.status === "limited" && ideas.length > 0 && (
          <p className="mt-4 border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
            No published problem statement was available when these ideas were generated. Treat
            them as broad starting points and verify the organiser's requirements before building.
          </p>
        )}

        {set?.grounding?.thin && set?.grounding?.status !== "limited" && ideas.length > 0 && (
          <p className="mt-4 border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
            Few closely matching past winners were found, so these ideas lean on this hackathon's
            own tracks rather than on proven patterns. Treat them as starting points.
          </p>
        )}

        <ol className="mt-4 space-y-3">
          {ideas.map((idea, i) => (
            <li key={i} className="rounded-2xl border border-line bg-raised p-5">
              <h4 className="text-[1.05rem] font-semibold leading-snug tracking-[-0.015em] text-balance">
                {idea.title}
              </h4>
              <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink/90">{idea.pitch}</p>

              {idea.problem_statement && (
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  <span className="font-medium text-ink">Targets:</span> {idea.problem_statement}
                </p>
              )}

              <div className="mt-4 border-l-2 border-accent pl-3">
                <p className="text-xs font-medium text-accent">Why it could win</p>
                <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
                  {idea.why_it_could_win}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {idea.track && <Tag accent>{idea.track}</Tag>}
                {idea.build_hours ? (
                  <Tag>
                    <Clock size={12} aria-hidden />
                    <span className="font-mono tabular-nums">~{idea.build_hours}h</span>
                  </Tag>
                ) : null}
                {idea.stack.slice(0, 6).map((tech) => (
                  <Tag key={tech}>{tech}</Tag>
                ))}
              </div>

              {idea.inspired_by.some((uid) => byUid.has(uid)) && (
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <Trophy size={14} aria-hidden className="mt-px shrink-0 text-faint" />
                  <span>
                    Inspired by{" "}
                    {idea.inspired_by
                      .map((uid) => byUid.get(uid))
                      .filter((e) => e !== undefined)
                      .map((e, j) => (
                        <span key={e.uid}>
                          {j > 0 && ", "}
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-accent"
                          >
                            {e.title}
                          </a>
                          {e.prize && ` (${e.prize}${e.year ? `, ${e.year}` : ""})`}
                        </span>
                      ))}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
