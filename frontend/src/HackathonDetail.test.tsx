import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HackathonDetail } from "./HackathonDetail";
import type { Hackathon } from "./types";

const hackathon: Hackathon = {
  uid: "unstop:1",
  source: "unstop",
  source_id: "1",
  title: "Travel Hack",
  url: "https://unstop.com/hackathons/travel-hack-1",
  tagline: null,
  starts_at: null,
  ends_at: null,
  reg_opens_at: null,
  reg_deadline: null,
  mode: "online",
  city: null,
  country: null,
  organiser: null,
  prize_amount: null,
  prize_currency: null,
  themes: [],
  tracks: [],
  sponsors: [],
  problem_sources: [
    {
      kind: "google_doc",
      title: "Official problem booklet",
      url: "https://docs.google.com/document/d/abc/edit",
      text: "Make travel safer for disabled visitors.",
      status: "parsed",
    },
  ],
  team_min: null,
  team_max: null,
  participants_count: null,
  domains: [],
  topic_labels: [],
  idea_count: 0,
  idea_teaser: null,
  slug: "travel-hack-1",
};

describe("hackathon details", () => {
  it("links Apply to the direct event page and shows published problems", () => {
    const html = renderToStaticMarkup(
      <HackathonDetail hackathon={hackathon} set={null} topics={new Map()} />,
    );
    expect(html).toContain('href="https://unstop.com/hackathons/travel-hack-1"');
    expect(html).toContain("Apply on Unstop");
    expect(html).toContain("Make travel safer for disabled visitors.");
    expect(html).toContain('href="https://docs.google.com/document/d/abc/edit"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
