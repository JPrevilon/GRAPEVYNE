import { describe, expect, it } from "vitest";

import { STORY_CHAPTERS } from "@/experience/storyChapters";

import { DIRECTORY_PAGE_HEADINGS } from "./directoryHeadingPresets";

const expectedPageTitles = {
  cellar: "YOUR CELLAR",
  demoCellar: "DEMO CELLAR",
  demoTasteAtlas: "DEMO TASTE ATLAS",
  discover: "DISCOVER WINES",
  login: "RETURN TO YOUR CELLAR",
  profile: "TASTE PROFILE",
  signup: "CREATE YOUR CELLAR",
} as const;

describe("static directory heading presets", () => {
  it("locks the approved route titles to uppercase, punctuation-free compositions", () => {
    expect(
      Object.fromEntries(
        Object.entries(DIRECTORY_PAGE_HEADINGS).map(([key, definition]) => [
          key,
          definition.ariaLabel,
        ]),
      ),
    ).toEqual(expectedPageTitles);

    Object.values(DIRECTORY_PAGE_HEADINGS).forEach(({ ariaLabel, segments }) => {
      expect(ariaLabel).toBe(ariaLabel.toUpperCase());
      expect(ariaLabel).not.toMatch(/[.!?]$/);
      expect(segments.map(({ text }) => text).join(" ")).toBe(ariaLabel);
    });
  });

  it("keeps every homepage title uppercase and free of terminal punctuation", () => {
    STORY_CHAPTERS.forEach(({ headingSegments, title }) => {
      expect(title).toBe(title.toUpperCase());
      expect(title).not.toMatch(/[.!?]$/);
      expect(headingSegments.map(({ text }) => text).join(" ")).toBe(title);
    });
  });
});
