import { useEffect, useState } from "react";
import type { Hackathon, IdeaSet } from "./types";
import { copyPrompt, formatDates, formatPrize, ideaFileName, where } from "./lib";

/**
 * The panel behind a hackathon card: what it is, ideas grounded in past winners, and the
 * exemplars those ideas came from.
 *
 * A dialog rather than a route, because the whole site is one static page and a router would add
 * a build-time page per hackathon for no benefit.
 */
export function Detail({
  hackathon,
  topics,
  onClose,
}: {
  hackathon: Hackathon;
  topics: Map<string, string>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [set, setSet] = useState<IdeaSet | null>(null);
  const [failed, setFailed] = useState(false);

  const ideas = set?.ideas ?? [];
  const exemplars = set?.exemplars ?? [];
  const byUid = new Map(exemplars.map((e) => [e.uid, e]));
  const loading = hackathon.idea_count > 0 && !set && !failed;

  // Ideas are ~6 KB each and most visitors open only a couple, so they are fetched here rather
  // than shipped in the index — that kept the initial download at 42 KB instead of 264 KB.
  useEffect(() => {
    if (hackathon.idea_count === 0) return;
    let live = true;
    const file = `${import.meta.env.BASE_URL}data/ideas/${ideaFileName(hackathon.uid)}`;
    fetch(file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: IdeaSet) => live && setSet(data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [hackathon.uid, hackathon.idea_count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Stop the list behind the dialog from scrolling under it.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleCopy() {
    const ok = await copyPrompt(hackathon, exemplars);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass my-4 w-full max-w-2xl rounded-3xl p-5 shadow-2xl shadow-black/60 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={hackathon.title}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-2xl">{hackathon.title}</h2>
            {hackathon.tagline && <p className="mt-1 text-sm text-muted">{hackathon.tagline}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-xl border border-white/10 px-2.5 py-1 text-sm text-muted transition hover:border-accent/50 hover:text-accent"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
          {[
            formatDates(hackathon),
            where(hackathon),
            formatPrize(hackathon),
            hackathon.team_max ? `Team up to ${hackathon.team_max}` : null,
            ...hackathon.domains.map((d) => topics.get(d) ?? d),
          ]
            .filter(Boolean)
            .map((label, i) => (
              <span key={i} className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-muted">
                {label}
              </span>
            ))}
        </div>

        {hackathon.tracks.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-1.5 text-sm font-semibold">Prize tracks</h3>
            <p className="text-sm text-muted">{hackathon.tracks.join(" · ")}</p>
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
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            title="Copies a ready-made prompt you can paste into ChatGPT or Gemini"
          >
            {copied ? "Copied ✓" : "Copy prompt for your own AI"}
          </button>
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
            Few closely-matching past winners were found, so these ideas lean on this hackathon's
            own tracks rather than on proven patterns. Treat them as starting points.
          </p>
        )}

        <ol className="space-y-3">
          {ideas.map((idea, i) => (
            <li key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <h4 className="font-semibold tracking-[-0.01em] text-ink">{idea.title}</h4>
              <p className="mt-1 text-sm">{idea.pitch}</p>
              <p className="mt-2 text-sm text-muted">
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
      </div>
    </div>
  );
}
