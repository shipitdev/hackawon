import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "@phosphor-icons/react";
import { HackathonDetail } from "./HackathonDetail";
import { loadIdeas } from "./data";
import { copyPrompt } from "./lib";
import type { Hackathon, IdeaSet } from "./types";

/**
 * The sheet shown when a row is opened. Dialog chrome and data loading only; the content itself
 * comes from HackathonDetail, which the prerendered page also uses.
 *
 * A native modal <dialog>: the browser keeps keyboard focus inside it, makes the page behind it
 * inert, and handles Escape. The hand-rolled div it replaced did none of those.
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [set, setSet] = useState<IdeaSet | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = hackathon.idea_count > 0 && !set && !failed;

  // Ideas are ~6 KB each and most visitors open only a couple, so they are fetched here rather
  // than shipped in the index. That kept the initial download at 48 KB instead of 264 KB.
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
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    // Stop the list behind the sheet from scrolling under it.
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleCopy() {
    const ok = await copyPrompt(hackathon, set?.exemplars ?? []);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <dialog
      ref={dialog}
      aria-label={hackathon.title}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Only a click on the backdrop lands on the dialog itself; the content fills it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-full">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/90 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-2xl">
              {hackathon.title}
            </h2>
            {hackathon.tagline && (
              <p className="mt-1 line-clamp-2 text-sm text-muted">{hackathon.tagline}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press -mr-2 shrink-0 rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="px-5 pb-12 pt-6 sm:px-8">
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
                className="press inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm font-medium text-ink hover:border-ink/25"
                title="Copies a ready-made prompt you can paste into ChatGPT or Gemini"
              >
                {copied ? (
                  <Check size={16} weight="bold" aria-hidden className="text-accent" />
                ) : (
                  <Copy size={16} aria-hidden />
                )}
                {copied ? "Copied" : "Copy AI prompt"}
              </button>
            }
          />
        </div>
      </div>
    </dialog>
  );
}
