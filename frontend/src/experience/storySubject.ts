import {
  STORY_CHAPTER_KEYS,
  STORY_SUBJECTS,
  type StoryChapter,
  type StorySubject,
} from "./storyChapters";

export const SUBJECT_FADE_OUT_START = 0.68;
export const SUBJECT_HIDDEN_AT = 0.82;
export const SUBJECT_FADE_IN_START = 0.9;

export interface StorySubjectFrame {
  current: StorySubject;
  currentOpacity: number;
  next: StorySubject;
  nextOpacity: number;
  phase: "entering" | "holding" | "hidden" | "leaving";
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number) {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
}

function rangeProgress(value: number, start: number, end: number) {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp((value - start) / (end - start));
}

export function getNextStoryChapter(chapter: StoryChapter) {
  const index = STORY_CHAPTER_KEYS.indexOf(chapter);
  return STORY_CHAPTER_KEYS[Math.min(index + 1, STORY_CHAPTER_KEYS.length - 1)] ?? chapter;
}

export function deriveStorySubjectFrame(
  chapter: StoryChapter,
  rawProgress: number,
): StorySubjectFrame {
  const progress = clamp(rawProgress);
  const current = STORY_SUBJECTS[chapter];
  const nextChapter = getNextStoryChapter(chapter);
  const next = STORY_SUBJECTS[nextChapter];
  const isFinal = nextChapter === chapter;

  if (isFinal || current === next) {
    return {
      current,
      currentOpacity: current === "none" ? 0 : 1,
      next,
      nextOpacity: 0,
      phase: current === "none" ? "hidden" : "holding",
    };
  }

  const currentOpacity =
    current === "none"
      ? 0
      : 1 -
        smoothstep(
          rangeProgress(progress, SUBJECT_FADE_OUT_START, SUBJECT_HIDDEN_AT),
        );
  const nextOpacity =
    next === "none"
      ? 0
      : smoothstep(
          rangeProgress(progress, SUBJECT_FADE_IN_START, 1),
        );

  let phase: StorySubjectFrame["phase"] = "holding";
  if (progress >= SUBJECT_HIDDEN_AT && progress < SUBJECT_FADE_IN_START) {
    phase = "hidden";
  } else if (progress >= SUBJECT_FADE_IN_START) {
    phase = "entering";
  } else if (progress >= SUBJECT_FADE_OUT_START) {
    phase = "leaving";
  }

  return { current, currentOpacity, next, nextOpacity, phase };
}

export function isAnyStorySubjectVisible(frame: StorySubjectFrame) {
  return frame.currentOpacity > 0.001 || frame.nextOpacity > 0.001;
}

export function isBottleAndGrapesSimultaneouslyVisible(
  frame: StorySubjectFrame,
) {
  const visible = new Set<StorySubject>();

  if (frame.currentOpacity > 0.001) visible.add(frame.current);
  if (frame.nextOpacity > 0.001) visible.add(frame.next);

  return visible.has("bottle") && visible.has("grapes");
}
