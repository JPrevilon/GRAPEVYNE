import { createContext, type Dispatch, type SetStateAction } from "react";

import type { StoryChapter } from "./storyChapters";

export interface SceneContextValue {
  chapter: StoryChapter;
  chapterIndex: number;
  currentChapterId: StoryChapter;
  homepageActive: boolean;
  prefersReducedMotion: boolean;
  setChapter: Dispatch<SetStateAction<StoryChapter>>;
  setCurrentChapterId: Dispatch<SetStateAction<StoryChapter>>;
  setHomepageActive: Dispatch<SetStateAction<boolean>>;
}

export const SceneContext = createContext<SceneContextValue | null>(null);
