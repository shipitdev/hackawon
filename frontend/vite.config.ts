import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Served from a GitHub Pages project page, so assets need the repo-name prefix.
  base: process.env.VITE_BASE ?? "/",
  test: { environment: "jsdom", globals: true },
});
