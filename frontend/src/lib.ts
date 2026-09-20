import type { Exemplar, Hackathon, Mode } from "./types";

export const SOURCE_LABELS: Record<string, string> = {
  devfolio: "Devfolio",
  unstop: "Unstop",
  mlh: "MLH",
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Whole calendar days until a date; negative means it has passed.
 *
 * Deliberately compares calendar days rather than elapsed hours: a deadline at 18:00 tonight is
 * "closes today", not "closes tomorrow", even though it is 20 hours away.
 */
export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((startOfDay(then).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** What a student actually needs to know: how long do I have to register? */
export function deadlineLabel(h: Hackathon, now = new Date()): string | null {
  const days = daysUntil(h.reg_deadline, now);
  if (days === null) return null;
  if (days < 0) return "Registration closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 7) return `Closes in ${days} days`;
  return null; // Far-off deadlines aren't urgent, so don't add noise.
}

export function isUrgent(h: Hackathon, now = new Date()): boolean {
  const days = daysUntil(h.reg_deadline, now);
  return days !== null && days >= 0 && days <= 7;
}

export function formatDates(h: Hackathon): string {
  // Most Unstop listings publish no event start date, only a registration window. Showing the
  // deadline is honest and is the date a student acts on; inventing a start date is not.
  if (!h.starts_at) {
    if (!h.reg_deadline) return "Dates TBA";
    const by = new Date(h.reg_deadline);
    return `Register by ${by.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }
  const start = new Date(h.starts_at);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startText = start.toLocaleDateString("en-IN", opts);
  if (!h.ends_at) return startText;
  const end = new Date(h.ends_at);
  if (start.toDateString() === end.toDateString()) return startText;
  return `${startText} - ${end.toLocaleDateString("en-IN", opts)}`;
}

export function formatPrize(h: Hackathon): string | null {
  if (!h.prize_amount) return null;
  const symbol = h.prize_currency === "INR" ? "₹" : h.prize_currency === "USD" ? "$" : "";
  return `${symbol}${h.prize_amount.toLocaleString("en-IN")}`;
}

export function where(h: Hackathon): string {
  if (h.mode === "online") return "Online";
  return h.city || h.country || h.organiser || "Location TBA";
}

export interface Filters {
  query: string;
  mode: Mode | "all";
  source: string | "all";
  domain: string | "all";
  onlyUrgent: boolean;
  hideAbroad: boolean;
  onlySaved: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  mode: "all",
  source: "all",
  domain: "all",
  onlyUrgent: false,
  hideAbroad: false,
  onlySaved: false,
};

function haystack(h: Hackathon): string {
  // Topic labels and the description matter as much as the name. Without them, searching
  // "fintech" returned 2 of the 13 hackathons actually labelled Fintech, because events like
  // "Buildonomics" never spell the word out.
  return [
    h.title,
    h.tagline,
    h.organiser,
    h.city,
    h.country,
    h.excerpt,
    ...h.themes,
    ...h.tracks,
    ...h.sponsors,
    ...h.topic_labels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const INDIA = new Set(["india", "in"]);

/**
 * True when we positively know the event is abroad.
 *
 * Deliberately asymmetric: Unstop publishes no country at all, and it is the most India-heavy
 * source we have. Treating "unknown" as foreign would hide most of the useful listings, so this
 * only excludes events whose country is known AND is not India.
 */
export function isKnownAbroad(h: Hackathon): boolean {
  if (h.mode === "online") return false;
  const country = (h.country ?? "").trim().toLowerCase();
  return country !== "" && !INDIA.has(country);
}

export function applyFilters(
  items: Hackathon[],
  f: Filters,
  now = new Date(),
  saved: string[] = [],
): Hackathon[] {
  const query = f.query.trim().toLowerCase();
  return items.filter((h) => {
    if (f.onlySaved && !saved.includes(h.uid)) return false;
    if (f.mode !== "all" && h.mode !== f.mode) return false;
    if (f.source !== "all" && h.source !== f.source) return false;
    if (f.domain !== "all" && !h.domains.includes(f.domain)) return false;
    if (f.onlyUrgent && !isUrgent(h, now)) return false;
    if (f.hideAbroad && isKnownAbroad(h)) return false;
    if (query && !haystack(h).includes(query)) return false;
    return true;
  });
}

/**
 * A ready-made prompt the student pastes into their own ChatGPT/Gemini.
 *
 * This is how personalisation works without a server: no API key of ours is exposed, nothing
 * costs us anything, and the student uses their own free account.
 */
export function buildPrompt(h: Hackathon, exemplars: Exemplar[] = []): string {
  const problems = h.problem_sources.flatMap((source) => {
    if (source.text) return [`- ${source.title ?? "Published context"}: ${source.text}`];
    if (source.url) return [`- ${source.title ?? "Problem statement"}: ${source.url}`];
    return [];
  });
  const lines = [
    `I'm entering a hackathon and want project ideas that could win it.`,
    ``,
    `Hackathon: ${h.title}`,
    h.tagline ? `Tagline: ${h.tagline}` : "",
    `Format: ${h.mode.replace("_", " ")}${h.city ? ` in ${h.city}` : ""}`,
    `Dates: ${formatDates(h)}`,
    h.team_max ? `Team size: up to ${h.team_max}` : "",
    formatPrize(h) ? `Prize pool: ${formatPrize(h)}` : "",
    h.sponsors.length ? `Sponsors: ${h.sponsors.join(", ")}` : "",
    h.tracks.length ? `Prize tracks:\n${h.tracks.map((t) => `- ${t}`).join("\n")}` : "",
    h.excerpt ? `\nAbout: ${h.excerpt}` : "",
    problems.length ? `\nPublished problem statements:\n${problems.join("\n")}` : "",
  ].filter(Boolean);

  if (exemplars.length) {
    lines.push(
      ``,
      `Projects that won similar hackathons:`,
      ...exemplars.map(
        (e) =>
          `- ${e.title}${e.prize ? ` (${e.prize})` : ""}${
            e.hackathon_name ? ` at ${e.hackathon_name}` : ""
          }${e.tech.length ? ` [${e.tech.join(", ")}]` : ""}`,
      ),
    );
  }

  lines.push(
    ``,
    `My skills: (describe what you know, e.g. React, Python, no ML experience)`,
    `Time available: (e.g. 24 hours, 3 people)`,
    ``,
    `Give me 5 specific ideas I could realistically finish in that time. Each idea must address one published problem`,
    `statement above when available, use the past winners only as execution evidence, and say why it could win. No generic ideas.`,
  );

  return lines.join("\n");
}

export async function copyPrompt(h: Hackathon, exemplars: Exemplar[] = []): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildPrompt(h, exemplars));
    return true;
  } catch {
    return false;
  }
}

/**
 * Where a hackathon's ideas live.
 *
 * The backend writes these filenames in `export_site.py` using the same rule. A mismatch would
 * 404 every idea file silently, so it is one function with a test rather than an inline replace
 * in two codebases.
 */
export function ideaFileName(uid: string): string {
  return `${uid.replace(":", "_")}.json`;
}
