import type { CSSProperties } from "react";

import type { StoryChapter } from "@/experience/storyChapters";

export type InteractiveStoryChapter =
  | "atlas"
  | "discovery"
  | "hero"
  | "portal";

interface StoryInteractionRectangle {
  height: string;
  left: string;
  right: string;
  top: string;
  width: string;
}

interface StoryInteractionRegion {
  desktop: StoryInteractionRectangle;
  mobile: StoryInteractionRectangle;
}

type StoryInteractionRegionStyle = CSSProperties &
  Record<
    | "--story-subject-control-height-desktop"
    | "--story-subject-control-height-mobile"
    | "--story-subject-control-left-desktop"
    | "--story-subject-control-left-mobile"
    | "--story-subject-control-right-desktop"
    | "--story-subject-control-right-mobile"
    | "--story-subject-control-top-desktop"
    | "--story-subject-control-top-mobile"
    | "--story-subject-control-width-desktop"
    | "--story-subject-control-width-mobile",
    string
  >;

/**
 * The only chapter-specific hit geometry for live story subjects. These
 * rectangles deliberately hug the approved projected poses and leave copy,
 * search, navigation, and chapter controls outside the pointer target.
 */
export const STORY_INTERACTION_REGIONS = {
  atlas: {
    desktop: {
      height: "74%",
      left: "56%",
      right: "auto",
      top: "12%",
      width: "clamp(10rem, 18vw, 22rem)",
    },
    mobile: {
      height: "58%",
      left: "auto",
      right: "2%",
      top: "25%",
      width: "40vw",
    },
  },
  discovery: {
    desktop: {
      height: "72%",
      left: "50%",
      right: "auto",
      top: "8%",
      width: "clamp(16rem, 30vw, 34rem)",
    },
    mobile: {
      height: "60%",
      left: "auto",
      right: "0",
      top: "8%",
      width: "56vw",
    },
  },
  hero: {
    desktop: {
      height: "74%",
      left: "55%",
      right: "auto",
      top: "12%",
      width: "clamp(12rem, 25vw, 27rem)",
    },
    mobile: {
      height: "62%",
      left: "auto",
      right: "2%",
      top: "18%",
      width: "44vw",
    },
  },
  portal: {
    desktop: {
      height: "74%",
      left: "28%",
      right: "auto",
      top: "12%",
      width: "clamp(11rem, 18vw, 22rem)",
    },
    mobile: {
      height: "62%",
      left: "0",
      right: "auto",
      top: "22%",
      width: "45vw",
    },
  },
} as const satisfies Record<InteractiveStoryChapter, StoryInteractionRegion>;

export function isInteractiveStoryChapter(
  chapter: StoryChapter,
): chapter is InteractiveStoryChapter {
  return chapter in STORY_INTERACTION_REGIONS;
}

export function getStoryInteractionRegionStyle(
  chapter: InteractiveStoryChapter,
): StoryInteractionRegionStyle {
  const { desktop, mobile } = STORY_INTERACTION_REGIONS[chapter];
  return {
    "--story-subject-control-height-desktop": desktop.height,
    "--story-subject-control-height-mobile": mobile.height,
    "--story-subject-control-left-desktop": desktop.left,
    "--story-subject-control-left-mobile": mobile.left,
    "--story-subject-control-right-desktop": desktop.right,
    "--story-subject-control-right-mobile": mobile.right,
    "--story-subject-control-top-desktop": desktop.top,
    "--story-subject-control-top-mobile": mobile.top,
    "--story-subject-control-width-desktop": desktop.width,
    "--story-subject-control-width-mobile": mobile.width,
  };
}
