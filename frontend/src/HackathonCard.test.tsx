import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HackathonCard } from "./HackathonCard";
import type { Hackathon } from "./types";

const hackathon: Hackathon = {
  uid: "unstop:1",
  source: "unstop",
  source_id: "1",
  title: "Travel Hack",
  url: "https://example.com/travel-hack",
  tagline: null,
  excerpt: "Build safer, more accessible journeys for disabled travellers.",
  starts_at: null,
  ends_at: null,
  reg_opens_at: null,
  reg_deadline: "2099-10-04T00:00:00Z",
  mode: "online",
  city: null,
  country: null,
  organiser: null,
  prize_amount: 100000,
  prize_currency: "INR",
  themes: [],
  tracks: [],
  sponsors: [],
  problem_sources: [],
  team_min: null,
  team_max: 4,
  participants_count: null,
  domains: ["accessibility"],
  topic_labels: ["Accessibility"],
  idea_count: 2,
  idea_teaser: "Route helper for every traveller",
  slug: "travel-hack-1",
};

describe("hackathon card", () => {
  it("shows the actionable depth without hiding the detail and save controls", () => {
    const html = renderToStaticMarkup(
      <HackathonCard
        h={hackathon}
        index={0}
        topics={new Map([["accessibility", "Accessibility"]])}
        onOpen={vi.fn()}
        saved={false}
        onToggleSave={vi.fn()}
      />,
    );

    expect(html).toContain("Travel Hack");
    expect(html).toContain("Build safer, more accessible journeys");
    expect(html).toContain("Route helper for every traveller");
    expect(html).toContain("₹1,00,000");
    expect(html).toContain("Up to 4");
    expect(html).toContain('aria-label="Save Travel Hack"');
  });

  it("opens the hackathon from its card while keeping save separate", async () => {
    const onOpen = vi.fn();
    const onToggleSave = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <HackathonCard
          h={hackathon}
          index={0}
          topics={new Map([['accessibility', 'Accessibility']])}
          onOpen={onOpen}
          saved={false}
          onToggleSave={onToggleSave}
        />,
      );
    });

    const title = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Travel Hack",
    );
    const save = host.querySelector<HTMLButtonElement>('[aria-label="Save Travel Hack"]');
    expect(title).toBeDefined();
    expect(save).not.toBeNull();

    await act(async () => title?.click());
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onToggleSave).not.toHaveBeenCalled();

    await act(async () => save?.click());
    expect(onToggleSave).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
