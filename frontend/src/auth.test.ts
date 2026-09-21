import { describe, expect, it } from "vitest";
import { oauthRedirectUrl } from "./auth";

describe("GitHub OAuth callback", () => {
  it("always returns to the app root instead of a dynamic hackathon page", () => {
    expect(oauthRedirectUrl("https://shipitdev.github.io", "/hackawon/")).toBe(
      "https://shipitdev.github.io/hackawon/",
    );
  });
});
