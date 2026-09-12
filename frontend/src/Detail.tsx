import { useEffect, useState } from "react";
import type { Hackathon } from "./types";
import { copyPrompt, formatDates, formatPrize, where } from "./lib";

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
  const ideas = hackathon.ideas ?? [];
  const exemplars = hackathon.exemplars ?? [];
  const byUid = new Map(exemplars.map((e) => [e.uid, e]));

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
    const ok = await copyPrompt(hackathon);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-4 w-full max-w-2xl rounded-xl border border-line bg-surface p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={hackathon.title}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold leading-tight">{hackathon.title}</h2>
            {hackathon.tagline && <p className="mt-1 text-sm text-muted">{hackathon.tagline}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-sm text-muted hover:border-accent/40"
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
              <span key={i} className="rounded-full border border-line bg-ink/4 px-2 py-0.5">
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
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Register on {hackathon.source}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-line px-3 py-2 text-sm hover:border-accent/40"
            title="Copies a ready-made prompt you can paste into ChatGPT or Gemini"
          >
            {copied ? "Copied ✓" : "Copy prompt for your own AI"}
          </button>
        </div>

        <h3 className="mb-2 text-sm font-semibold">
          Project ideas{ideas.length > 0 && ` (${ideas.length})`}
        </h3>

        {ideas.length === 0 && (
          <p className="rounded-lg border border-line p-4 text-sm text-muted">
            No ideas generated for this one yet. The “Copy prompt” button above gives you a
            ready-made prompt with this hackathon's tracks and sponsors filled in.
          </p>
        )}

        {hackathon.grounding?.thin && ideas.length > 0 && (
          <p className="mb-3 rounded-lg border border-line bg-ink/4 p-3 text-xs text-muted">
            Few closely-matching past winners were found, so these ideas lean on this hackathon's
            own tracks rather than on proven patterns. Treat them as starting points.
          </p>
        )}

        <ol className="space-y-3">
          {ideas.map((idea, i) => (
            <li key={i} className="rounded-lg border border-line p-4">
              <h4 className="font-semibold">{idea.title}</h4>
              <p className="mt-1 text-sm">{idea.pitch}</p>
              <p className="mt-2 text-sm text-muted">
                <span className="font-medium text-ink/80">Why it could win: </span>
                {idea.why_it_could_win}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
                {idea.track && (
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-accent">
                    {idea.track}
                  </span>
                )}
                {idea.build_hours ? (
                  <span className="rounded-full border border-line px-2 py-0.5">
                    ~{idea.build_hours}h
                  </span>
                ) : null}
                {idea.stack.slice(0, 6).map((tech) => (
                  <span key={tech} className="rounded-full border border-line px-2 py-0.5">
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
