import { describe, expect, it } from "vitest";
import { applyFilters, daysUntil, deadlineLabel, EMPTY_FILTERS, formatPrize, isUrgent, where } from "./lib";
import type { Hackathon } from "./types";

const NOW = new Date("2026-09-12T00:00:00Z");

function make(overrides: Partial<Hackathon> = {}): Hackathon {
  return {
    uid: "devfolio:1",
    source: "devfolio",
    source_id: "1",
    title: "Hack Something",
    url: "https://example.com/",
    tagline: null,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: null,
    reg_opens_at: null,
    reg_deadline: null,
    mode: "in_person",
    city: "Kolkata",
    country: "India",
    organiser: null,
    prize_amount: null,
    prize_currency: null,
    themes: [],
    tracks: [],
    sponsors: [],
    team_min: null,
    team_max: null,
    participants_count: null,
    domains: [],
    idea_count: 0,
    ...overrides,
  };
}

describe("deadlines", () => {
  it("counts whole days", () => {
    expect(daysUntil("2026-09-15T00:00:00Z", NOW)).toBe(3);
  });

  it("returns null when there is no deadline", () => {
    expect(daysUntil(null, NOW)).toBeNull();
  });

  it("survives an unparseable date", () => {
    expect(daysUntil("not a date", NOW)).toBeNull();
  });

  it("says today rather than 'in 0 days'", () => {
    const h = make({ reg_deadline: "2026-09-12T18:00:00Z" });
    expect(deadlineLabel(h, NOW)).toBe("Closes today");
  });

  it("flags a closed registration", () => {
    const h = make({ reg_deadline: "2026-09-01T00:00:00Z" });
    expect(deadlineLabel(h, NOW)).toBe("Registration closed");
  });

  it("stays quiet about far-off deadlines", () => {
    const h = make({ reg_deadline: "2026-12-01T00:00:00Z" });
    expect(deadlineLabel(h, NOW)).toBeNull();
    expect(isUrgent(h, NOW)).toBe(false);
  });

  it("treats the next week as urgent", () => {
    expect(isUrgent(make({ reg_deadline: "2026-09-16T00:00:00Z" }), NOW)).toBe(true);
  });
});

describe("display helpers", () => {
  it("shows online events as Online, not a city", () => {
    expect(where(make({ mode: "online", city: "Kolkata" }))).toBe("Online");
  });

  it("falls back when a city is missing (common for Unstop)", () => {
    expect(where(make({ city: null, country: null, organiser: "IIT Delhi" }))).toBe("IIT Delhi");
  });

  it("formats rupees with Indian digit grouping", () => {
    expect(formatPrize(make({ prize_amount: 150000, prize_currency: "INR" }))).toBe("₹1,50,000");
  });

  it("shows nothing when there is no prize", () => {
    expect(formatPrize(make())).toBeNull();
  });
});

describe("filtering", () => {
  const items = [
    make({ uid: "a", title: "AI Hack", mode: "online", source: "devfolio" }),
    make({ uid: "b", title: "Fintech Jam", mode: "in_person", source: "unstop" }),
    make({ uid: "c", title: "Closing Soon", source: "mlh", reg_deadline: "2026-09-14T00:00:00Z" }),
  ];

  it("returns everything by default", () => {
    expect(applyFilters(items, EMPTY_FILTERS, NOW)).toHaveLength(3);
  });

  it("filters by mode", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, mode: "online" }, NOW);
    expect(out.map((h) => h.uid)).toEqual(["a"]);
  });

  it("filters by source", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, source: "unstop" }, NOW);
    expect(out.map((h) => h.uid)).toEqual(["b"]);
  });

  it("searches case-insensitively", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, query: "FINTECH" }, NOW);
    expect(out.map((h) => h.uid)).toEqual(["b"]);
  });

  it("searches sponsors and tracks, not just titles", () => {
    const withSponsor = [make({ uid: "s", sponsors: ["ElevenLabs"] })];
    expect(applyFilters(withSponsor, { ...EMPTY_FILTERS, query: "elevenlabs" }, NOW)).toHaveLength(1);
  });

  it("filters by topic", () => {
    const tagged = [
      make({ uid: "ai", domains: ["ai-ml"] }),
      make({ uid: "fin", domains: ["fintech"] }),
      make({ uid: "both", domains: ["ai-ml", "fintech"] }),
    ];
    const out = applyFilters(tagged, { ...EMPTY_FILTERS, domain: "ai-ml" }, NOW);
    expect(out.map((h) => h.uid)).toEqual(["ai", "both"]);
  });

  it("hides unlabelled hackathons from a topic filter but not from the default view", () => {
    const items = [make({ uid: "none", domains: [] })];
    expect(applyFilters(items, EMPTY_FILTERS, NOW)).toHaveLength(1);
    expect(applyFilters(items, { ...EMPTY_FILTERS, domain: "ai-ml" }, NOW)).toHaveLength(0);
  });

  it("combines filters", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, onlyUrgent: true }, NOW);
    expect(out.map((h) => h.uid)).toEqual(["c"]);
  });
});

describe("the abroad filter", () => {
  const items = [
    make({ uid: "in", country: "India", mode: "in_person" }),
    make({ uid: "us", country: "US", mode: "in_person" }),
    make({ uid: "unknown", country: null, mode: "in_person" }),
    make({ uid: "online", country: "US", mode: "online" }),
  ];

  it("hides events we know are abroad", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, hideAbroad: true }, NOW);
    expect(out.map((h) => h.uid)).not.toContain("us");
  });

  it("keeps listings with no country", () => {
    // Unstop publishes no country and is our most India-heavy source; treating unknown as
    // foreign would hide most of the useful listings.
    const out = applyFilters(items, { ...EMPTY_FILTERS, hideAbroad: true }, NOW);
    expect(out.map((h) => h.uid)).toContain("unknown");
  });

  it("keeps online events wherever they are run from", () => {
    const out = applyFilters(items, { ...EMPTY_FILTERS, hideAbroad: true }, NOW);
    expect(out.map((h) => h.uid)).toContain("online");
  });

  it("is off by default", () => {
    expect(applyFilters(items, EMPTY_FILTERS, NOW)).toHaveLength(4);
  });
});
