import { renderToStaticMarkup } from "react-dom/server";
import { DetailPage } from "./DetailPage";
import { ToolsPage } from "./ToolsPage";
import type { Domain, Hackathon, IdeaSet, ToolsBundle } from "./types";

/**
 * Build-time rendering entry point, used by `scripts/prerender.mjs`.
 *
 * `renderToStaticMarkup` rather than `renderToString`: these pages are never hydrated, so the
 * hydration bookkeeping React would otherwise emit is dead weight.
 */
export function renderHackathon(
  hackathon: Hackathon,
  set: IdeaSet | null,
  domains: Domain[],
  base: string,
): string {
  return renderToStaticMarkup(
    <DetailPage hackathon={hackathon} set={set} domains={domains} base={base} />,
  );
}

/** Everything the page's <head> needs, derived from the hackathon's own fields. */
export function pageMeta(hackathon: Hackathon, ideaCount: number) {
  const where =
    hackathon.mode === "online" ? "Online" : (hackathon.city ?? hackathon.country ?? "");
  const bits = [where, hackathon.prize_amount ? "prizes" : null].filter(Boolean).join(", ");

  const title = `${hackathon.title} — hackathon${bits ? ` (${bits})` : ""} | Hackawon`;

  // Taglines often already end in punctuation, which produced "Impossible.. 5 project ideas".
  const lead = (hackathon.tagline || hackathon.title).trim().replace(/[.!?]+$/, "");
  const description =
    ideaCount > 0
      ? `${lead}. ${ideaCount} project ideas grounded in what has won similar hackathons, plus dates, prizes and tracks.`
      : `${lead}. Dates, prizes, tracks and how to register.`;

  return { title, description: description.slice(0, 300) };
}

export function renderTools(data: ToolsBundle, base: string): string {
  return renderToStaticMarkup(<ToolsPage data={data} base={base} />);
}
