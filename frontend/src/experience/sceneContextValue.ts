import {
  createContext,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type { StoryChapter } from "./storyChapters";
import type { StoryTransitionState } from "./storyTransition";

export interface SceneProgress {
  boundaries: number[];
  chapter: number;
  direction: -1 | 0 | 1;
  forceBlackGate: boolean;
  navigationTargetIndex: number | null;
  requestStoryFrame?: () => void;
  setRenderActivity?: (active: boolean) => void;
  story: number;
  storyVisible: boolean;
  transition: StoryTransitionState;
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
