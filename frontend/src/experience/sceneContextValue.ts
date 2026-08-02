import {
  createContext,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type { StoryChapter } from "./storyChapters";

export interface SceneProgress {
  chapter: number;
  setRenderActivity?: (active: boolean) => void;
  story: number;
  storyVisible: boolean;
}

export interface SceneContextValue {
  chapter: StoryChapter;
  chapterIndex: number;
  currentChapterId: StoryChapter;
  homepageActive: boolean;
  prefersReducedMotion: boolean;
  progressRef: MutableRefObject<SceneProgress>;
  setChapter: Dispatch<SetStateAction<StoryChapter>>;
  setCurrentChapterId: Dispatch<SetStateAction<StoryChapter>>;
  setHomepageActive: Dispatch<SetStateAction<boolean>>;
}

export const SceneContext = createContext<SceneContextValue | null>(null);
