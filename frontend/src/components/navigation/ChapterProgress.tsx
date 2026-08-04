import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { STORY_CHAPTERS, getStoryChapter } from "@/experience/storyChapters";
import { useScene } from "@/experience/useScene";

export default function ChapterProgress() {
  const { chapterIndex, currentChapterId, setCurrentChapterId } = useScene();
  const [open, setOpen] = useState(false);
  const menuId = `${useId()}-story-chapters`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = getStoryChapter(currentChapterId);
  const currentNumber = String(chapterIndex + 1).padStart(2, "0");

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <nav aria-label="From Vine to Memory chapters" className="gv-chapter-progress">
      <div
        aria-label={`${currentNumber} of 09 — ${current.navLabel}`}
        aria-valuemax={STORY_CHAPTERS.length}
        aria-valuemin={1}
        aria-valuenow={chapterIndex + 1}
        className="gv-chapter-progress__status"
        role="progressbar"
      >
        <span>{currentNumber} / 09</span>
        <span>{current.navLabel}</span>
      </div>

      <div aria-hidden="true" className="gv-chapter-progress__track">
        <span className="gv-chapter-progress__fill" />
      </div>

      <button
        aria-controls={menuId}
        aria-expanded={open}
        className="gv-chapter-progress__trigger"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        {open ? <X aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        <span>{open ? "CLOSE CHAPTERS" : "ALL CHAPTERS"}</span>
      </button>

      <div className="gv-chapter-progress__menu" hidden={!open} id={menuId}>
        <ol>
          {STORY_CHAPTERS.map(({ anchorId, key, navLabel, number }) => (
            <li key={key}>
              <a
                aria-current={currentChapterId === key ? "step" : undefined}
                href={`#${anchorId}`}
                onClick={() => {
                  setCurrentChapterId(key);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span aria-hidden="true">{number}</span>
                <span>{navLabel}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
