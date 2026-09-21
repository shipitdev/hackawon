import type { Bundle, IdeaSet, ToolsBundle } from "./types";
import { ideaFileName } from "./lib";

/**
 * Every read of app data goes through here.
 *
 * Today it fetches static JSON built by GitHub Actions, which is why the public site costs
 * nothing to run. When per-user features arrive (sign in with GitHub, favourites, reminders),
 * they add functions to this module — the components stay untouched.
 *
 * Public data deliberately stays static: listings and ideas are identical for every visitor, so
 * moving them behind a service would add cost and fragility for no benefit. Only per-user state
 * needs a database.
 */

const base = () => import.meta.env.BASE_URL;

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${base()}${path}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

/** The listings index: every hackathon, minus the ideas themselves. ~48 KB gzipped. */
export function loadIndex(): Promise<Bundle> {
  return getJSON<Bundle>("data/hackathons.json");
}

export function loadTools(): Promise<ToolsBundle> {
  return getJSON<ToolsBundle>("data/tools.json");
}

/**
 * One hackathon's ideas and the past winners they cite.
 *
 * Fetched on demand: with 264 hackathons carrying five ideas each these totalled ~988 KB, and
 * most visitors open only a couple.
 */
export function loadIdeas(uid: string): Promise<IdeaSet> {
  return getJSON<IdeaSet>(`data/ideas/${ideaFileName(uid)}`);
}
