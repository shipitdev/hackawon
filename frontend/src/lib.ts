import type { Hackathon, Mode } from "./types";

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
  return `${startText} – ${end.toLocaleDateString("en-IN", opts)}`;
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
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  mode: "all",
  source: "all",
  domain: "all",
  onlyUrgent: false,
};

function haystack(h: Hackathon): string {
  return [h.title, h.tagline, h.organiser, h.city, h.country, ...h.themes, ...h.tracks, ...h.sponsors]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function applyFilters(items: Hackathon[], f: Filters, now = new Date()): Hackathon[] {
  const query = f.query.trim().toLowerCase();
  return items.filter((h) => {
    if (f.mode !== "all" && h.mode !== f.mode) return false;
    if (f.source !== "all" && h.source !== f.source) return false;
    if (f.domain !== "all" && !h.domains.includes(f.domain)) return false;
    if (f.onlyUrgent && !isUrgent(h, now)) return false;
    if (query && !haystack(h).includes(query)) return false;
    return true;
  });
}
