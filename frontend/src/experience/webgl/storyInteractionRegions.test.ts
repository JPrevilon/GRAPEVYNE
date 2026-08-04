import { describe, expect, it } from "vitest";

import { STORY_CHAPTERS } from "@/experience/storyChapters";

import {
  STORY_INTERACTION_REGIONS,
  getStoryInteractionRegionStyle,
  isInteractiveStoryChapter,
} from "./storyInteractionRegions";

describe("story interaction hit regions", () => {
  it("defines one typed desktop/mobile rectangle only for live-subject chapters", () => {
    expect(Object.keys(STORY_INTERACTION_REGIONS)).toEqual([
      "atlas",
      "discovery",
      "hero",
      "portal",
    ]);

    for (const chapter of STORY_CHAPTERS) {
      expect(isInteractiveStoryChapter(chapter.key)).toBe(
        chapter.subject !== "none",
      );
    }
  });

  it.each(Object.keys(STORY_INTERACTION_REGIONS) as Array<keyof typeof STORY_INTERACTION_REGIONS>)(
    "projects both viewport modes into CSS variables for %s",
    (chapter) => {
      const style = getStoryInteractionRegionStyle(chapter);
      expect(style["--story-subject-control-top-desktop"]).toBeTruthy();
      expect(style["--story-subject-control-left-desktop"]).toBeTruthy();
      expect(style["--story-subject-control-width-desktop"]).toBeTruthy();
      expect(style["--story-subject-control-height-desktop"]).toBeTruthy();
      expect(style["--story-subject-control-top-mobile"]).toBeTruthy();
      expect(style["--story-subject-control-left-mobile"]).toBeTruthy();
      expect(style["--story-subject-control-width-mobile"]).toBeTruthy();
      expect(style["--story-subject-control-height-mobile"]).toBeTruthy();
    },
  );
});
