import { getClient } from "./auth";
import type { Viewer } from "./auth";

/**
 * Saved hackathons.
 *
 * Works before anyone signs in: favourites live in the browser, so the feature is useful to an
 * anonymous visitor and degrades to nothing worse than "this device only". Signing in merges what
 * was saved locally into the account rather than discarding it — losing someone's saved list as a
 * reward for creating an account would be a poor trade.
 *
 * The table is `favourites (user_id uuid, hackathon_uid text)`, keyed on the stable `uid` from the
 * exporter. Row level security restricts every row to its owner, which is what makes direct
 * browser access safe.
 */

export const STORAGE_KEY = "hackawon.favourites.v1";
const TABLE = "favourites";

/**
 * `localStorage` is absent in two real situations, not just in tests: during the build, when the
 * prerenderer renders these modules in Node, and in browsers that block storage for the origin.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLocal(): string[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // Private windows, cleared site data, or another tab writing junk.
    return [];
  }
}

export function writeLocal(uids: string[]): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(uids));
  } catch {
    // Storage can be disabled or full. Favourites are a convenience, never a requirement.
  }
}

/** Union, preserving the order things were first seen so the list does not reshuffle. */
export function mergeFavourites(local: string[], remote: string[]): string[] {
  return [...new Set([...local, ...remote])];
}

export function toggle(uids: string[], uid: string): string[] {
  return uids.includes(uid) ? uids.filter((u) => u !== uid) : [...uids, uid];
}

/**
 * The viewer's list. Signed out: whatever this browser has. Signed in: the account's rows, with
 * anything saved locally merged in and pushed up.
 */
export async function loadFavourites(viewer: Viewer | null): Promise<string[]> {
  const local = readLocal();
  // Signed out: never touch the network, and never load the Supabase library.
  if (!viewer) return local;
  const db = await getClient();
  if (!db) return local;

  const { data, error } = await db.from(TABLE).select("hackathon_uid");
  if (error) return local; // offline, or the table is not created yet

  const remote = (data ?? []).map((row) => row.hackathon_uid as string);
  const merged = mergeFavourites(local, remote);

  const unsynced = merged.filter((uid) => !remote.includes(uid));
  if (unsynced.length > 0) {
    await db
      .from(TABLE)
      .upsert(
        unsynced.map((uid) => ({ user_id: viewer.id, hackathon_uid: uid })),
        { onConflict: "user_id,hackathon_uid" },
      );
  }

  writeLocal(merged);
  return merged;
}

/**
 * Persist one change.
 *
 * Deliberately takes a single uid and its new state rather than a whole list. An earlier version
 * took the current list and returned a new one, which lost a favourite when someone clicked two
 * stars quickly: the second call had captured the pre-first-click list and overwrote it. The
 * caller owns the list; this function only records one add or remove.
 *
 * A failed write leaves the local copy intact, which the next sign-in re-syncs.
 */
export async function persistFavourite(
  uid: string,
  isSaved: boolean,
  viewer: Viewer | null,
): Promise<void> {
  if (!viewer) return;
  const db = await getClient();
  if (!db) return;

  if (isSaved) {
    await db
      .from(TABLE)
      .upsert({ user_id: viewer.id, hackathon_uid: uid }, { onConflict: "user_id,hackathon_uid" });
  } else {
    await db.from(TABLE).delete().eq("user_id", viewer.id).eq("hackathon_uid", uid);
  }
}
