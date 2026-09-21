import { GithubLogo } from "@phosphor-icons/react";
import type { Viewer } from "./auth";

/** The name, as a link home. Shared with the static pages, which have no account controls. */
export function Wordmark({ base }: { base: string }) {
  return (
    <a href={base} className="text-[0.95rem] font-semibold tracking-[-0.04em] text-ink">
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
    <header className="sticky top-0 z-40 border-b border-hero-ink/20 bg-hero/90 text-hero-ink backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-10">
        <Wordmark base={base} />

        <nav aria-label="Primary" className="flex min-w-0 items-center gap-0.5 font-mono">
          <a
            href={`${base}tools/`}
            className="press inline-flex min-h-11 items-center rounded px-3 text-xs font-medium uppercase tracking-[0.08em] text-hero-ink/75 hover:bg-hero-ink/10 hover:text-hero-ink"
          >
            Toolkit
          </a>

          {viewer ? (
              <>
                <span className="flex min-h-11 items-center gap-2 px-2 text-xs text-hero-ink/75">
                  {viewer.avatar && (
                    <img
                      src={viewer.avatar}
                      alt=""
                      width={22}
                      height={22}
                      className="rounded ring-1 ring-hero-ink/25"
                    />
                  )}
                  <span className="hidden sm:inline">{viewer.handle ?? "Signed in"}</span>
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="press min-h-11 rounded px-3 text-xs uppercase tracking-[0.08em] text-hero-ink/65 hover:bg-hero-ink/10 hover:text-hero-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={busy || !authEnabled}
                title={
                  authEnabled
                    ? "Keeps your saved hackathons across devices"
                    : "GitHub sign-in is not configured for this local build"
                }
                className="press ml-1 flex min-h-11 items-center gap-1.5 rounded border border-hero-ink/35 px-3 text-xs font-medium uppercase tracking-[0.08em] text-hero-ink hover:bg-hero-ink/10 disabled:opacity-60"
              >
                <GithubLogo size={15} weight="bold" aria-hidden />
                Sign in
              </button>
            )}
        </nav>
      </div>
    </header>
  );
}
