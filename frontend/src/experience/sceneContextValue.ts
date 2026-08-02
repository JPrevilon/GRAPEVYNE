import { createContext, type Dispatch, type SetStateAction } from "react";

export const STORY_CHAPTERS = [
  "hero",
  "discover",
  "match",
  "taste",
  "portal",
  "cellar",
  "memory",
  "atlas",
  "finale",
] as const;

export type StoryChapter = (typeof STORY_CHAPTERS)[number];

export interface SceneContextValue {
  chapter: StoryChapter;
  prefersReducedMotion: boolean;
  setChapter: Dispatch<SetStateAction<StoryChapter>>;
}

export const SceneContext = createContext<SceneContextValue | null>(null);
