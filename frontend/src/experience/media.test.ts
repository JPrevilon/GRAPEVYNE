import { describe, expect, it } from "vitest";

import { CINEMATIC_MEDIA } from "./media";
import { STORY_CHAPTERS } from "./storyChapters";

describe("cinematic media registry", () => {
  it("maps all nine chapters to distinct desktop/mobile scrub sources", () => {
    expect(STORY_CHAPTERS).toHaveLength(9);
    expect(new Set(STORY_CHAPTERS.map(({ mediaKey }) => mediaKey)).size).toBe(9);

    STORY_CHAPTERS.forEach(({ mediaKey }) => {
      const media = CINEMATIC_MEDIA[mediaKey];
      expect(media.desktop.mp4).toMatch(/\.desktop\.mp4$/);
      expect(media.desktop.webm).toMatch(/\.desktop\.webm$/);
      expect(media.desktop.poster).toMatch(/\.desktop\.jpg$/);
      expect(media.mobile.mp4).toMatch(/\.mobile\.mp4$/);
      expect(media.mobile.webm).toMatch(/\.mobile\.webm$/);
      expect(media.mobile.poster).toMatch(/\.mobile\.jpg$/);
    });
  });

  it("locks the four supplied story-master production names", () => {
    expect(CINEMATIC_MEDIA.vineyard.desktop.mp4).toContain(
      "/vineyard-flight.desktop.mp4",
    );
    expect(CINEMATIC_MEDIA.dateNight.desktop.mp4).toContain(
      "/date-night-table-pan.desktop.mp4",
    );
    expect(CINEMATIC_MEDIA.barrelHouse.desktop.mp4).toContain(
      "/barrel-house-pan.desktop.mp4",
    );
    expect(CINEMATIC_MEDIA.oceanVoyage.desktop.mp4).toContain(
      "/ocean-wine-voyage.desktop.mp4",
    );
  });
});
