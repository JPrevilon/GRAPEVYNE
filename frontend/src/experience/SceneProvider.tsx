import { type PropsWithChildren, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";

import { SceneContext, type SceneProgress } from "./sceneContextValue";
import { STORY_CHAPTER_KEYS, type StoryChapter } from "./storyChapters";
import { deriveStoryTransitionState } from "./storyTransition";

export function SceneProvider({ children }: PropsWithChildren) {
  const [chapter, setChapter] = useState<StoryChapter>("hero");
  const [homepageActive, setHomepageActive] = useState(false);
  const progressRef = useRef<SceneProgress>({
    boundaries: STORY_CHAPTER_KEYS.map((_, index) =>
      index / Math.max(STORY_CHAPTER_KEYS.length - 1, 1),
    ),
    chapter: 0,
    direction: 0,
    forceBlackGate: true,
    navigationTargetIndex: null,
    story: 0,
    storyVisible: false,
    transition: deriveStoryTransitionState({
      lowerReady: false,
      overallProgress: 0,
    }),
  });
  const prefersReducedMotion = useReducedMotion();

  const value = useMemo(
    () => ({
      chapter,
      chapterIndex: STORY_CHAPTER_KEYS.indexOf(chapter),
      currentChapterId: chapter,
      homepageActive,
      prefersReducedMotion,
      progressRef,
      setChapter,
      setCurrentChapterId: setChapter,
      setHomepageActive,
    }),
    [chapter, homepageActive, prefersReducedMotion],
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}
