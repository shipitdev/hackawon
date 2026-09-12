import type { Session, SupabaseClient } from "@supabase/supabase-js";

/**
 * Sign in with GitHub, and nothing else.
 *
 * There is no server. Supabase's browser client performs the OAuth flow and talks to Postgres
 * directly, with row level security deciding what a signed-in user may touch. That keeps the whole
 * site on free static hosting even with accounts.
 *
 * **The library is loaded lazily and usually not at all.** Bundling it outright took the main
 * chunk from 67 KB to 125 KB gzipped — nearly double, for a feature most visitors never use. So
 * nothing is imported until either a stored session is found or someone clicks sign in. Browsing
 * anonymously costs zero extra bytes.
 *
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **public by design**: the anon key is meant
 * to ship in a browser bundle, and the database's own policies protect the data. The Postgres
 * connection string and the service_role key must never appear here — this code is world-readable.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authConfigured = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * True when this browser already holds a Supabase session.
 *
 * Read straight from storage by key shape (`sb-<ref>-auth-token`) so we can answer without
 * loading the library — which is the entire point.
 */
export function hasStoredSession(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Storage blocked; treat as signed out.
  }
  return false;
}

/** Loads and memoises the client. Returns null when this build has no credentials. */
export async function getClient(): Promise<SupabaseClient | null> {
  if (!authConfigured) return null;
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

export interface Viewer {
  id: string;
  handle: string | null;
  avatar: string | null;
}

function toViewer(session: Session | null): Viewer | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    // GitHub gives a login and an avatar; both are friendlier than showing an email.
    handle: (meta.user_name as string) ?? (meta.preferred_username as string) ?? null,
    avatar: (meta.avatar_url as string) ?? null,
  };
}

/** Whether the page was just returned to by the OAuth redirect, which carries tokens in the URL. */
function returningFromOAuth(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.hash.includes("access_token") || window.location.hash.includes("error="))
  );
}

export async function currentViewer(): Promise<Viewer | null> {
  // The common case: no session and no redirect, so never load the library.
  if (!authConfigured || (!hasStoredSession() && !returningFromOAuth())) return null;
  const db = await getClient();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return toViewer(data.session);
}

/** Calls back when the viewer signs in or out. Returns an unsubscribe function. */
export function onViewerChange(fn: (viewer: Viewer | null) => void): () => void {
  if (!authConfigured || (!hasStoredSession() && !returningFromOAuth())) return () => {};

  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  getClient().then((db) => {
    if (!db || cancelled) return;
    const { data } = db.auth.onAuthStateChange((_event, session) => fn(toViewer(session)));
    unsubscribe = () => data.subscription.unsubscribe();
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function signInWithGitHub(): Promise<void> {
  const db = await getClient();
  // Come back to the page the visitor was on, not always the homepage.
  await db?.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.href },
  });
}

export async function signOut(): Promise<void> {
  const db = await getClient();
  await db?.auth.signOut();
}
