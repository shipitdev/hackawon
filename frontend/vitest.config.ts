import { defineConfig } from "vitest/config";

/**
 * Separate from vite.config.ts on purpose: the `test` key there was silently ignored, so tests ran
 * in a Node environment with no `localStorage` and the favourites tests could not run at all.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    // jsdom withholds localStorage for an opaque origin and Vitest does not surface it here,
    // so the setup file installs a minimal in-memory Storage. See src/test-setup.ts.
    setupFiles: ["./src/test-setup.ts"],
  },
});
