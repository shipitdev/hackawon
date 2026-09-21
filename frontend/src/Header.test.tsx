import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

describe("site header", () => {
  it("keeps GitHub sign-in visible when local auth is not configured", () => {
    const html = renderToStaticMarkup(
      <Header
        base="/hackawon/"
        viewer={null}
        authEnabled={false}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(html).toContain('href="/hackawon/tools/"');
    expect(html).toContain("Sign in");
    expect(html).toContain('disabled=""');
  });

  it("enables GitHub sign-in when auth is configured", () => {
    const html = renderToStaticMarkup(
      <Header
        base="/"
        viewer={null}
        authEnabled
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(html).toContain('href="/tools/"');
    expect(html).toContain("Sign in");
    expect(html).not.toContain('disabled=""');
  });

  it("keeps the configured GitHub sign-in button wired to its auth action", async () => {
    const onSignIn = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <Header base="/" viewer={null} authEnabled onSignIn={onSignIn} onSignOut={vi.fn()} />,
      );
    });

    const signIn = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Sign in",
    );
    expect(signIn).toBeDefined();

    await act(async () => signIn?.click());
    expect(onSignIn).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
