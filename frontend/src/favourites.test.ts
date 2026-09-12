import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, mergeFavourites, readLocal, toggle, writeLocal } from "./favourites";

describe("local storage of favourites", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(readLocal()).toEqual([]);
  });

  it("round-trips", () => {
    writeLocal(["devfolio:1", "unstop:2"]);
    expect(readLocal()).toEqual(["devfolio:1", "unstop:2"]);
  });

  it("survives corrupted storage", () => {
    // A private window, cleared site data, or another tab writing junk.
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readLocal()).toEqual([]);
  });

  it("ignores non-array contents", () => {
    localStorage.setItem(STORAGE_KEY, '{"a":1}');
    expect(readLocal()).toEqual([]);
  });

  it("does not throw when storage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => writeLocal(["devfolio:1"])).not.toThrow();
    spy.mockRestore();
  });

  it("keeps only strings", () => {
    localStorage.setItem(STORAGE_KEY, '["devfolio:1", 42, null]');
    expect(readLocal()).toEqual(["devfolio:1"]);
  });
});

describe("merging what was saved before signing in", () => {
  it("keeps both sides", () => {
    expect(mergeFavourites(["a", "b"], ["c"])).toEqual(["a", "b", "c"]);
  });

  it("never duplicates", () => {
    expect(mergeFavourites(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("survives either side being empty", () => {
    expect(mergeFavourites([], ["a"])).toEqual(["a"]);
    expect(mergeFavourites(["a"], [])).toEqual(["a"]);
  });

  it("is stable, so the UI does not reshuffle", () => {
    const once = mergeFavourites(["b", "a"], ["c"]);
    expect(mergeFavourites(["b", "a"], ["c"])).toEqual(once);
  });
});

describe("toggling", () => {
  it("adds what is missing", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes what is present", () => {
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });

  it("does not mutate the input", () => {
    const before = ["a"];
    toggle(before, "b");
    expect(before).toEqual(["a"]);
  });
});
