import { useEffect, useState } from "react";
import { HackathonDetail } from "./HackathonDetail";
import { loadIdeas } from "./data";
import { copyPrompt } from "./lib";
import type { Hackathon, IdeaSet } from "./types";

/**
 * The modal shown when a card is clicked. Dialog chrome and data loading only — the content
 * itself comes from HackathonDetail, which the prerendered page also uses.
 */
export function Detail({
  hackathon,
  topics,
  onClose,
}: {
  hackathon: Hackathon;
  topics: Map<string, string>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [set, setSet] = useState<IdeaSet | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = hackathon.idea_count > 0 && !set && !failed;

  // Ideas are ~6 KB each and most visitors open only a couple, so they are fetched here rather
  // than shipped in the index — that kept the initial download at 48 KB instead of 264 KB.
  useEffect(() => {
    if (hackathon.idea_count === 0) return;
    let live = true;
    loadIdeas(hackathon.uid)
      .then((data) => live && setSet(data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [hackathon.uid, hackathon.idea_count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Stop the list behind the dialog from scrolling under it.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleCopy() {
    const ok = await copyPrompt(hackathon, set?.exemplars ?? []);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass my-4 w-full max-w-2xl rounded-3xl p-5 shadow-2xl shadow-black/60 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={hackathon.title}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-2xl">
              {hackathon.title}
            </h2>
            {hackathon.tagline && <p className="mt-1 text-sm text-muted">{hackathon.tagline}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-xl border border-white/10 px-2.5 py-1 text-sm text-muted transition hover:border-accent/50 hover:text-accent"
          >
            ✕
          </button>
        </div>

        <HackathonDetail
          hackathon={hackathon}
          set={set}
          topics={topics}
          loading={loading}
          failed={failed}
          copySlot={
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
              title="Copies a ready-made prompt you can paste into ChatGPT or Gemini"
            >
              {copied ? "Copied ✓" : "Copy prompt for your own AI"}
            </button>
          }
        />
      </div>
    </div>
  );
}
