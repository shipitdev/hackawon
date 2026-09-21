import { Lightbulb, Star } from "@phosphor-icons/react";
import { deadlineLabel, formatDates, formatPrize, SOURCE_LABELS, where } from "./lib";
import type { Hackathon } from "./types";

function modeLabel(mode: Hackathon["mode"]) {
  if (mode === "in_person") return "In person";
  if (mode === "online") return "Online";
  if (mode === "hybrid") return "Hybrid";
  return "Format TBA";
}

export function HackathonCard({
  h,
  index,
  topics,
  onOpen,
  saved,
  onToggleSave,
}: {
  h: Hackathon;
  index: number;
  topics: Map<string, string>;
  onOpen: () => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const deadline = deadlineLabel(h);
  const prize = formatPrize(h);
  const summary = h.tagline || h.excerpt;
  const span = index % 4 === 0 || index % 4 === 3 ? "xl:col-span-7" : "xl:col-span-5";

  return (
    <article
      className={`reveal group relative flex min-w-0 flex-col border border-line bg-raised p-5 transition-colors hover:border-ink/40 has-[h3_button:focus-visible]:border-accent has-[h3_button:focus-visible]:outline-2 has-[h3_button:focus-visible]:outline-accent sm:p-6 ${
        deadline ? "hackathon-card--urgent" : ""
      } ${span}`}
    >
      <div className="flex min-h-11 items-start justify-between gap-4 pr-10 font-mono text-[0.66rem] font-medium uppercase tracking-[0.08em] text-faint">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{SOURCE_LABELS[h.source] ?? h.source}</span>
          <span aria-hidden>/</span>
          <span>{modeLabel(h.mode)}</span>
        </div>
        <div className="text-right">
          <p>{formatDates(h)}</p>
          {deadline && <p className="mt-1 text-accent">{deadline}</p>}
        </div>
      </div>

      <h3 className="mt-5 max-w-[24ch] text-2xl font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-3xl">
        <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 focus-visible:outline-none">
          {h.title}
        </button>
      </h3>

      {summary && <p className="mt-3 line-clamp-3 max-w-[60ch] text-sm leading-relaxed text-muted">{summary}</p>}

      {h.idea_teaser && (
        <p className="mt-5 flex items-start gap-2 border-l-2 border-accent pl-3 text-sm leading-snug text-ink">
          <Lightbulb size={16} weight="duotone" aria-hidden className="mt-px shrink-0 text-accent" />
          <span className="line-clamp-2">
            {h.idea_teaser}
            {h.idea_count > 1 && <span className="text-faint"> and {h.idea_count - 1} more ideas</span>}
          </span>
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-4 text-sm">
        <div>
          <dt className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-faint">Where</dt>
          <dd className="mt-1 line-clamp-1 text-muted">{where(h)}</dd>
        </div>
        {(prize || h.team_max) && (
          <div>
            <dt className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-faint">Reward / team</dt>
            <dd className="mt-1 font-mono tabular-nums text-ink">
              {prize || "Prize TBA"}{h.team_max ? ` / Up to ${h.team_max}` : ""}
            </dd>
          </div>
        )}
      </dl>

      {h.domains.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-faint">
          {h.domains.slice(0, 3).map((domain) => (
            <span key={domain}>{topics.get(domain) ?? domain}</span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleSave}
        aria-label={saved ? `Remove ${h.title} from saved` : `Save ${h.title}`}
        aria-pressed={saved}
        title={saved ? "Saved. Click to remove" : "Save for later"}
        className={`press absolute right-3 top-3 z-10 grid min-h-11 min-w-11 place-items-center rounded ${
          saved ? "text-accent" : "text-faint hover:bg-sunken hover:text-ink"
        }`}
      >
        <Star size={18} weight={saved ? "fill" : "regular"} aria-hidden />
      </button>
    </article>
  );
}
