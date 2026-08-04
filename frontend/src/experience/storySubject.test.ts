import { describe, expect, it } from "vitest";

import { STORY_SUBJECTS } from "./storyChapters";
import {
  deriveStorySubjectFrame,
  isBottleAndGrapesSimultaneouslyVisible,
} from "./storySubject";

describe("story subject contract", () => {
  it("locks bottle, grapes, and object-free chapters exactly", () => {
    expect(STORY_SUBJECTS).toEqual({
      atlas: "bottle",
      cellar: "none",
      discovery: "grapes",
      finale: "none",
      hero: "bottle",
      match: "none",
      memory: "none",
      portal: "bottle",
      taste: "none",
    });
  });

  it("passes through a fully hidden frame before changing subject", () => {
    const leaving = deriveStorySubjectFrame("hero", 0.75);
    const hidden = deriveStorySubjectFrame("hero", 0.86);
    const entering = deriveStorySubjectFrame("hero", 0.95);

    expect(leaving.current).toBe("bottle");
    expect(leaving.currentOpacity).toBeGreaterThan(0);
    expect(leaving.nextOpacity).toBe(0);
    expect(hidden).toMatchObject({
      currentOpacity: 0,
      nextOpacity: 0,
      phase: "hidden",
    });
    expect(entering.currentOpacity).toBe(0);
    expect(entering.next).toBe("grapes");
    expect(entering.nextOpacity).toBeGreaterThan(0);
  });

  it("never exposes bottle and grapes in the same projected frame", () => {
    for (let step = 0; step <= 100; step += 1) {
      const frame = deriveStorySubjectFrame("hero", step / 100);
      expect(isBottleAndGrapesSimultaneouslyVisible(frame)).toBe(false);
    }
  });

  it("is deterministic and reversible because it is a pure progress projection", () => {
    const forward = [0, 0.7, 0.82, 0.9, 1].map((progress) =>
      deriveStorySubjectFrame("portal", progress),
    );
    const reverse = [1, 0.9, 0.82, 0.7, 0]
      .map((progress) => deriveStorySubjectFrame("portal", progress))
      .reverse();

    expect(reverse).toEqual(forward);
  });
});
