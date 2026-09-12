import { describe, expect, it } from "vitest";
import { buildPrompt, ideaFileName } from "./lib";
import type { Hackathon } from "./types";

function make(overrides: Partial<Hackathon> = {}): Hackathon {
  return {
    uid: "devfolio:1",
    source: "devfolio",
    source_id: "1",
    title: "HackSpire'26",
    url: "https://x/",
    tagline: "Innovate to Inspire",
    starts_at: "2026-10-02T00:00:00Z",
    ends_at: "2026-10-03T00:00:00Z",
    reg_opens_at: null,
    reg_deadline: null,
    mode: "in_person",
    city: "Kolkata",
    country: "India",
    organiser: null,
    prize_amount: 150000,
    prize_currency: "INR",
    themes: [],
    tracks: ["Grand Prize", "Best use of ElevenLabs"],
    sponsors: ["ElevenLabs"],
    team_min: 2,
    team_max: 4,
    participants_count: null,
    domains: ["ai-ml"],
    topic_labels: ["AI & Machine Learning"],
    idea_count: 0,
    idea_teaser: null,
    slug: "hack-something-1",
    ...overrides,
  };
}

describe("the copy-prompt fallback", () => {
  it("carries the details a student could not paste themselves", () => {
    const prompt = buildPrompt(make());
    expect(prompt).toContain("HackSpire'26");
    expect(prompt).toContain("Best use of ElevenLabs");
    expect(prompt).toContain("ElevenLabs");
    expect(prompt).toContain("Kolkata");
    expect(prompt).toContain("₹1,50,000");
  });

  it("includes past winners when we have them", () => {
    // Exemplars now arrive from a separately-fetched file, so they are passed in.
    const prompt = buildPrompt(make(), [
      {
        uid: "github:1",
        title: "Haven",
        url: "https://x/1",
        prize: "1st place",
        hackathon_name: "MongoDB AI Hackathon",
        year: 2025,
        tech: ["Python"],
      },
    ]);
    expect(prompt).toContain("Haven");
    expect(prompt).toContain("MongoDB AI Hackathon");
  });

  it("asks the student for the two things we cannot know", () => {
    const prompt = buildPrompt(make());
    expect(prompt).toMatch(/My skills/);
    expect(prompt).toMatch(/Time available/);
  });

  it("works for a bare hackathon with no tracks or sponsors", () => {
    const prompt = buildPrompt(make({ tracks: [], sponsors: [], prize_amount: null }));
    expect(prompt).toContain("HackSpire'26");
    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("null");
  });
});

describe("idea file naming", () => {
  it("matches the filename the backend writes", () => {
    // backend: data/ideas/<uid with ':' -> '_'>.json
    expect(ideaFileName("devfolio:9f3e3e2e")).toBe("devfolio_9f3e3e2e.json");
    expect(ideaFileName("unstop:1737808")).toBe("unstop_1737808.json");
    expect(ideaFileName("mlh:14416")).toBe("mlh_14416.json");
  });
});
