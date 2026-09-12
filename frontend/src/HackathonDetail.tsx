import type { Hackathon, IdeaSet } from "./types";
import { formatDates, formatPrize, where } from "./lib";

/**
 * Everything known about one hackathon, as markup.
 *
 * Purely presentational: no fetching, no dialog chrome, no state. Both consumers render this, so
 * the modal and the prerendered `/h/<slug>` page cannot drift apart:
 *
 *   Detail.tsx     — modal, fetches the ideas, wraps this in dialog chrome
 *   DetailPage.tsx — standalone page, data passed in at build time by the prerenderer
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
    formatDates(hackathon),
    where(hackathon),
    formatPrize(hackathon),
    hackathon.team_max ? `Team up to ${hackathon.team_max}` : null,
    ...hackathon.domains.map((d) => topics.get(d) ?? d),
  ].filter(Boolean);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
        {facts.map((label, i) => (
          <span
            key={i}
            className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-muted"
          >
            {label}
          </span>
        ))}
      </div>

      {hackathon.tracks.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-1.5 text-sm font-semibold">Prize tracks</h3>
          <p className="text-sm leading-relaxed text-muted">{hackathon.tracks.join(" · ")}</p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href={hackathon.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
        >
          Register on {hackathon.source}
        </a>
        {copySlot}
      </div>

      <h3 className="mb-2 text-sm font-semibold">
        Project ideas{hackathon.idea_count > 0 && ` (${hackathon.idea_count})`}
      </h3>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: Math.min(hackathon.idea_count, 3) }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]"
            />
          ))}
        </div>
      )}

      {failed && (
        <p className="rounded-2xl border border-white/8 p-4 text-sm leading-relaxed text-muted">
          Could not load the ideas for this one. The “Copy prompt” button above still works.
        </p>
      )}

      {!loading && !failed && ideas.length === 0 && (
        <p className="rounded-2xl border border-white/8 p-4 text-sm leading-relaxed text-muted">
          No ideas generated for this one yet. The “Copy prompt” button above gives you a
          ready-made prompt with this hackathon's tracks and sponsors filled in.
        </p>
      )}

      {set?.grounding?.thin && ideas.length > 0 && (
        <p className="mb-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-relaxed text-muted">
          Few closely-matching past winners were found, so these ideas lean on this hackathon's own
          tracks rather than on proven patterns. Treat them as starting points.
        </p>
      )}

      <ol className="space-y-3">
        {ideas.map((idea, i) => (
          <li key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <h4 className="font-semibold tracking-[-0.01em] text-ink">{idea.title}</h4>
            <p className="mt-1 text-sm leading-relaxed">{idea.pitch}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="font-medium text-ink/80">Why it could win: </span>
              {idea.why_it_could_win}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
              {idea.track && (
                <span className="rounded-full border border-accent/30 bg-accent/12 px-2 py-0.5 text-accent">
                  {idea.track}
                </span>
              )}
              {idea.build_hours ? (
                <span className="rounded-full border border-white/8 px-2 py-0.5">
                  ~{idea.build_hours}h
                </span>
              ) : null}
              {idea.stack.slice(0, 6).map((tech) => (
                <span key={tech} className="rounded-full border border-white/8 px-2 py-0.5">
                  {tech}
                </span>
              ))}
            </div>
            {idea.inspired_by.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Inspired by:{" "}
                {idea.inspired_by.map((uid, j) => {
                  const e = byUid.get(uid);
                  if (!e) return null;
                  return (
                    <span key={uid}>
                      {j > 0 && ", "}
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-accent"
                      >
                        {e.title}
                      </a>
                      {e.prize && ` (${e.prize}${e.year ? `, ${e.year}` : ""})`}
                    </span>
                  );
                })}
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
