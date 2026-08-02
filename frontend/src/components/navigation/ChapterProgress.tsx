import { STORY_CHAPTERS } from "@/experience/storyChapters";
import { useScene } from "@/experience/useScene";

export default function ChapterProgress() {
  const { chapterIndex, currentChapterId, setCurrentChapterId } = useScene();

  return (
    <nav aria-label="From Vine to Memory chapters" className="gv-chapter-progress">
      <p className="gv-visually-hidden" id="story-progress-label">
        Chapter {chapterIndex + 1} of {STORY_CHAPTERS.length}
      </p>
      <div aria-hidden="true" className="gv-chapter-progress__track">
        <span className="gv-chapter-progress__fill" />
      </div>
      <ol>
        {STORY_CHAPTERS.map(({ anchorId, key, navLabel, number }) => (
          <li key={key}>
            <a
              aria-current={currentChapterId === key ? "step" : undefined}
              href={`#${anchorId}`}
              onClick={() => setCurrentChapterId(key)}
            >
              <span aria-hidden="true">{number}</span>
              <span>{navLabel}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
