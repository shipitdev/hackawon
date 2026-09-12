/**
 * Test environment shims.
 *
 * jsdom refuses to provide `localStorage` for an opaque origin, and Vitest's jsdom environment
 * does not expose it on `globalThis` here regardless of `environmentOptions`. Rather than fight
 * that, install a minimal in-memory Storage when one is missing: these tests exist to verify our
 * own read/write/merge logic, not the browser's storage implementation.
 *
 * The production code guards against storage being absent anyway — it has to, because the
 * prerenderer renders the same modules in Node.
 */
class MemoryStorage implements Storage {
  #items = new Map<string, string>();

  get length() {
    return this.#items.size;
  }
  clear() {
    this.#items.clear();
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#items.delete(key);
  }
  setItem(key: string, value: string) {
    this.#items.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
