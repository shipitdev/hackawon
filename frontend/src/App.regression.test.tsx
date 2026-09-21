import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bundle, Hackathon } from "./types";

const mocks = vi.hoisted(() => ({ loadIndex: vi.fn(), signInWithGitHub: vi.fn() }));

vi.mock("./data", () => ({
  loadIndex: mocks.loadIndex,
  loadIdeas: vi.fn().mockResolvedValue({ ideas: [], exemplars: [], grounding: { exemplar_count: 0, domains: [], thin: false, patterns: [] } }),
}));

vi.mock("./auth", () => ({
  authConfigured: true,
  currentViewer: vi.fn().mockResolvedValue(null),
  onViewerChange: vi.fn(() => () => {}),
  signInWithGitHub: mocks.signInWithGitHub,
  signOut: vi.fn(),
}));

vi.mock("./favourites", () => ({
  loadFavourites: vi.fn().mockResolvedValue([]),
  persistFavourite: vi.fn(),
  toggle: (saved: string[], uid: string) => [...saved, uid],
  writeLocal: vi.fn(),
}));

import App from "./App";

const hackathon: Hackathon = {
  uid: "unstop:travel",
  source: "unstop",
  source_id: "travel",
  title: "Travel Hack",
  url: "https://unstop.com/hackathons/travel-hack",
  tagline: "Build safer journeys.",
  starts_at: null,
  ends_at: null,
  reg_opens_at: null,
  reg_deadline: "2099-10-04T00:00:00Z",
  mode: "online",
  city: null,
  country: null,
  organiser: null,
  prize_amount: null,
  prize_currency: null,
  themes: [],
  tracks: [],
  sponsors: [],
  problem_sources: [],
  team_min: null,
  team_max: null,
  participants_count: null,
  domains: [],
  topic_labels: [],
  idea_count: 0,
  idea_teaser: null,
  slug: "travel-hack",
};

const bundle: Bundle = {
  generated_at: "2026-09-21T00:00:00Z",
  count: 1,
  domains: [],
  hackathons: [hackathon],
};

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("homepage regression flow", () => {
  it("keeps sign-in, toolkit, card detail, and Apply navigation available", async () => {
    mocks.loadIndex.mockResolvedValue(bundle);
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModal });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const toolkit = host.querySelector<HTMLAnchorElement>('a[href="/tools/"]');
    const signIn = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Sign in",
    );
    const card = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Travel Hack",
    );
    expect(toolkit).not.toBeNull();
    expect(signIn).toBeDefined();
    expect(card).toBeDefined();

    await act(async () => signIn?.click());
    expect(mocks.signInWithGitHub).toHaveBeenCalledOnce();

    await act(async () => card?.click());
    const dialog = host.querySelector<HTMLDialogElement>("dialog");
    const apply = dialog?.querySelector<HTMLAnchorElement>('a[href="https://unstop.com/hackathons/travel-hack"]');
    expect(showModal).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/h/travel-hack/");
    expect(apply?.textContent).toContain("Apply on Unstop");
    expect(apply?.target).toBe("_blank");

    await act(async () => root.unmount());
  });
});
