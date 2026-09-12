import type { Viewer } from "./auth";

/**
 * Site chrome: identity on the left, navigation and account on the right.
 *
 * These controls used to sit inside the filter bar, which was wrong: "sign in" and "toolkit" are
 * not filters, and mixing them in made a row of eight lookalike pills where six changed the list
 * and two did something else entirely. Navigation belongs above the content it navigates.
 */
export function Header({
  base,
  viewer,
  authEnabled,
  onSignIn,
  onSignOut,
  busy = false,
}: {
  base: string;
  viewer: Viewer | null;
  authEnabled: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  busy?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-surface/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5 sm:px-6">
        <a
          href={base}
          className="group flex items-baseline gap-2 text-[0.95rem] font-semibold tracking-[-0.02em] text-ink"
        >
          Hackawon
          <span className="hidden text-[0.7rem] font-normal text-faint transition group-hover:text-muted sm:inline">
            hackathons, and ideas that win
          </span>
        </a>

        <nav className="flex items-center gap-1.5">
          <a
            href={`${base}tools/`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-white/5 hover:text-ink"
          >
            Toolkit
          </a>

          {authEnabled &&
            (viewer ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted">
                  {viewer.avatar && (
                    <img
                      src={viewer.avatar}
                      alt=""
                      width={22}
                      height={22}
                      className="rounded-full ring-1 ring-white/15"
                    />
                  )}
                  <span className="hidden sm:inline">{viewer.handle ?? "Signed in"}</span>
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-faint transition hover:bg-white/5 hover:text-ink"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={busy}
                title="Keeps your saved hackathons across devices"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink transition hover:border-accent/40 hover:bg-white/[0.07] disabled:opacity-60"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
  );
}
