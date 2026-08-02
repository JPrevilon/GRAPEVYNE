import { describe, expect, it } from "vitest";

import { STORY_CHAPTER_KEYS } from "@/experience/storyChapters";

import { getClampedPointerRotation } from "./pointerMotion";
import {
  BOTTLE_SCENE_TARGETS,
  MAX_POINTER_PITCH,
  MAX_POINTER_YAW,
} from "./sceneTargets";

describe("persistent bottle scene targets", () => {
  it.each(["high", "standard"] as const)(
    "provides a valid %s target for all nine chapters in both directions",
    (tier) => {
      const targets = BOTTLE_SCENE_TARGETS[tier];

      expect(Object.keys(targets).sort()).toEqual(
        [...STORY_CHAPTER_KEYS].sort(),
      );
      expect(STORY_CHAPTER_KEYS).toHaveLength(9);

      [STORY_CHAPTER_KEYS, [...STORY_CHAPTER_KEYS].reverse()].forEach(
        (chapterOrder) => {
          chapterOrder.forEach((chapter) => {
            const target = targets[chapter];

            expect(target.visible).toBe(true);
            expect(target.position).toHaveLength(3);
            expect(target.rotation).toHaveLength(3);
            expect(
              [
                ...target.position,
                ...target.rotation,
                target.scale,
                target.keyLight,
                target.decoration,
              ].every(
                Number.isFinite,
              ),
            ).toBe(true);
            expect(target.scale).toBeGreaterThan(0);
            expect(target.keyLight).toBeGreaterThan(0);
            expect(target.decoration).toBeGreaterThanOrEqual(0);
          });
        },
      );
    },
  );

  it("keeps standard mobile composition distinct from every desktop chapter", () => {
    STORY_CHAPTER_KEYS.forEach((chapter) => {
      expect(BOTTLE_SCENE_TARGETS.standard[chapter]).not.toEqual(
        BOTTLE_SCENE_TARGETS.high[chapter],
      );
      expect(BOTTLE_SCENE_TARGETS.standard[chapter].scale).toBeLessThan(
        BOTTLE_SCENE_TARGETS.high[chapter].scale,
      );
    });
  });

  it("clamps pointer parallax to four degrees yaw and two degrees pitch", () => {
    expect(MAX_POINTER_YAW).toBeCloseTo((4 * Math.PI) / 180);
    expect(MAX_POINTER_PITCH).toBeCloseTo((2 * Math.PI) / 180);
    expect(getClampedPointerRotation(500, 250, 1000, 500)).toEqual({
      pitch: -0,
      yaw: 0,
    });
    expect(
      getClampedPointerRotation(Number.POSITIVE_INFINITY, -1000, 1000, 500),
    ).toEqual({
      pitch: MAX_POINTER_PITCH,
      yaw: MAX_POINTER_YAW,
    });
    expect(getClampedPointerRotation(-1000, 1000, 1000, 500)).toEqual({
      pitch: -MAX_POINTER_PITCH,
      yaw: -MAX_POINTER_YAW,
    });
  });
});
