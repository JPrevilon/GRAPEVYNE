import { type PropsWithChildren, useMemo, useState } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";

import { SceneContext } from "./sceneContextValue";
import { STORY_CHAPTER_KEYS, type StoryChapter } from "./storyChapters";

export function SceneProvider({ children }: PropsWithChildren) {
  const [chapter, setChapter] = useState<StoryChapter>("hero");
  const [homepageActive, setHomepageActive] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const value = useMemo(
    () => ({
      chapter,
      chapterIndex: STORY_CHAPTER_KEYS.indexOf(chapter),
      currentChapterId: chapter,
      homepageActive,
      prefersReducedMotion,
      setChapter,
      setCurrentChapterId: setChapter,
      setHomepageActive,
    }),
    [chapter, homepageActive, prefersReducedMotion],
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}
