import { describe, expect, it } from "vitest";
import { isToolsPath } from "./routes";

describe("client routes", () => {
  it.each([
    ["/tools", "/"],
    ["/tools/", "/"],
    ["/hackawon/tools", "/hackawon/"],
    ["/hackawon/tools/", "/hackawon/"],
  ])("recognises the toolkit path %s with base %s", (pathname, base) => {
    expect(isToolsPath(pathname, base)).toBe(true);
  });

  it("does not treat the homepage or detail pages as the toolkit", () => {
    expect(isToolsPath("/", "/")).toBe(false);
    expect(isToolsPath("/h/example/", "/")).toBe(false);
  });
});
