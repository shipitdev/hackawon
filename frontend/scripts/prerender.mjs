/**
 * Writes a real HTML page for every hackathon, plus a sitemap.
 *
 * Why: the app is a single client-rendered page, so search engines saw an empty div and a
 * hackathon had no URL of its own — there was no way to share one. This turns 267 modal states
 * into 267 indexable, linkable pages.
 *
 * Runs after `vite build` (client) and `vite build --ssr`, reading the same JSON the site serves
 * and the same React components the modal uses, so nothing can drift.
 *
 * Usage: node scripts/prerender.mjs [--base /hackawon/] [--origin https://example.github.io]
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("base", process.env.VITE_BASE || "/");
const ORIGIN = flag("origin", process.env.SITE_ORIGIN || "https://shipitdev.github.io").replace(
  /\/$/,
  "",
);
const DIST = path.resolve("dist");
const SSR_ENTRY = path.resolve("dist-ssr/entry-server.js");

function fail(message) {
  console.error(`prerender: ${message}`);
  process.exit(1);
}

if (!existsSync(DIST)) fail("dist/ missing — run `vite build` first");
if (!existsSync(SSR_ENTRY)) fail("dist-ssr/ missing — run `vite build --ssr src/entry-server.tsx`");

const { renderHackathon, renderTools, pageMeta } = await import(SSR_ENTRY);

const bundle = JSON.parse(await readFile(path.join(DIST, "data/hackathons.json"), "utf8"));

// Reuse the stylesheet and favicon links the client build already produced, so these pages are
// styled identically without hardcoding hashed filenames.
const shell = await readFile(path.join(DIST, "index.html"), "utf8");
const headLinks = [...shell.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join("");

if (!headLinks) fail("no stylesheet found in dist/index.html — did the client build succeed?");

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function document({ title, description, url, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}" />
<link rel="canonical" href="${escape(url)}" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f9f9fb" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141417" />
<link rel="icon" type="image/svg+xml" href="${BASE}favicon.svg" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:url" content="${escape(url)}" />
<meta name="twitter:card" content="summary" />
${headLinks}
</head>
<body>${body}</body>
</html>
`;
}

// Ideas live in one file per hackathon; read whichever exist.
const ideasDir = path.join(DIST, "data/ideas");
const ideaFiles = existsSync(ideasDir) ? new Set(await readdir(ideasDir)) : new Set();

let written = 0;
const urls = [`${ORIGIN}${BASE}`];

for (const hackathon of bundle.hackathons) {
  if (!hackathon.slug) continue;

  const fileName = `${hackathon.uid.replace(":", "_")}.json`;
  const set = ideaFiles.has(fileName)
    ? JSON.parse(await readFile(path.join(ideasDir, fileName), "utf8"))
    : null;

  const url = `${ORIGIN}${BASE}h/${hackathon.slug}/`;
  const { title, description } = pageMeta(hackathon, set?.ideas?.length ?? 0);
  const body = renderHackathon(hackathon, set, bundle.domains ?? [], BASE);

  const dir = path.join(DIST, "h", hackathon.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), document({ title, description, url, body }));

  urls.push(url);
  written++;
}

// The toolkit page, if its data has been exported.
const toolsFile = path.join(DIST, "data/tools.json");
if (existsSync(toolsFile)) {
  const tools = JSON.parse(await readFile(toolsFile, "utf8"));
  const url = `${ORIGIN}${BASE}tools/`;
  await mkdir(path.join(DIST, "tools"), { recursive: true });
  await writeFile(
    path.join(DIST, "tools", "index.html"),
    document({
      title: "The hackathon toolkit: free API credits, auth, slides | Hackawon",
      description: `${tools.count} tools worth knowing about before a hackathon starts: model API free tiers, auth and databases, hosting, slide decks and UI kits. Each entry says what you actually get.`,
      url,
      body: renderTools(tools, BASE),
    }),
  );
  urls.push(url);
  console.log("prerender: tools page");
}

const lastmod = (bundle.generated_at ?? new Date().toISOString()).slice(0, 10);
await writeFile(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escape(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>
`,
);

await writeFile(
  path.join(DIST, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}${BASE}sitemap.xml\n`,
);

console.log(`prerender: ${written} hackathon pages, sitemap with ${urls.length} urls`);
