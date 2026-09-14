import { GithubLogo } from "@phosphor-icons/react";
import type { Viewer } from "./auth";

/** The name, as a link home. Shared with the static pages, which have no account controls. */
export function Wordmark({ base }: { base: string }) {
  return (
    <a href={base} className="text-[0.95rem] font-semibold tracking-[-0.03em] text-ink">
      Hackawon
    </a>
  );
}

/**
 * Site chrome: identity on the left, navigation and account on the right.
 *
 * These controls used to sit inside the filter bar, which was wrong: "sign in" and "toolkit" are
 * not filters. Navigation belongs above the content it navigates.
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
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Wordmark base={base} />

        <nav className="flex items-center gap-1">
          <a
            href={`${base}tools/`}
            className="press rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-sunken hover:text-ink"
          >
            Toolkit
          </a>

          {authEnabled &&
            (viewer ? (
              <>
                <span className="flex items-center gap-2 px-2 text-sm text-muted">
                  {viewer.avatar && (
                    <img
                      src={viewer.avatar}
                      alt=""
                      width={22}
                      height={22}
                      className="rounded-md ring-1 ring-line"
                    />
                  )}
                  <span className="hidden sm:inline">{viewer.handle ?? "Signed in"}</span>
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="press rounded-lg px-3 py-1.5 text-sm text-faint hover:bg-sunken hover:text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={busy}
                title="Keeps your saved hackathons across devices"
                className="press ml-1 flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-sm font-medium text-ink hover:border-ink/25 disabled:opacity-60"
              >
                <GithubLogo size={15} weight="bold" aria-hidden />
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
  );
}
