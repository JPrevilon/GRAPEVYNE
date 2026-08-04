import { describe, expect, it } from "vitest";

import {
  DEFAULT_STORY_BOUNDARIES,
  STORY_BOUNDARY_COUNT,
  STORY_OWNER_FORWARD_THRESHOLD,
  STORY_OWNER_REVERSE_THRESHOLD,
  STORY_TRANSITION_FADE_END,
  STORY_TRANSITION_REVEAL_START,
  STORY_TRANSITION_SEGMENT_LENGTH,
  STORY_TRANSITION_SEGMENT_START,
  deriveStoryTransitionState,
  isNormalizedStoryBoundaryList,
  type StoryTransitionState,
} from "./storyTransition";

function progressAtTransition(boundaryIndex: number, progress: number) {
  const lower = DEFAULT_STORY_BOUNDARIES[boundaryIndex] ?? 0;
  const upper = DEFAULT_STORY_BOUNDARIES[boundaryIndex + 1] ?? 1;
  const segmentProgress =
    STORY_TRANSITION_SEGMENT_START +
    STORY_TRANSITION_SEGMENT_LENGTH * progress;
  return lower + (upper - lower) * segmentProgress;
}

function project(boundaryIndex: number, progress: number) {
  return deriveStoryTransitionState({
    overallProgress: progressAtTransition(boundaryIndex, progress),
  });
}

describe("story transition coordinator", () => {
  it("accepts only a normalized nine-entry chapter-anchor list", () => {
    expect(isNormalizedStoryBoundaryList(DEFAULT_STORY_BOUNDARIES)).toBe(true);
    expect(isNormalizedStoryBoundaryList([0, 0.5, 1])).toBe(false);
    expect(
      isNormalizedStoryBoundaryList([0, 0.1, 0.2, 0.3, 0.4, 0.4, 0.7, 0.8, 1]),
    ).toBe(false);
    expect(
      isNormalizedStoryBoundaryList([0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]),
    ).toBe(true);
  });

  it.each(Array.from({ length: STORY_BOUNDARY_COUNT }, (_, index) => index))(
    "uses the shared fade, black hold, and reveal contract at boundary %i",
    (boundaryIndex) => {
      const start = project(boundaryIndex, 0);
      const fade = project(boundaryIndex, STORY_TRANSITION_FADE_END / 2);
      const holdStart = project(boundaryIndex, STORY_TRANSITION_FADE_END);
      const hold = project(
        boundaryIndex,
        (STORY_TRANSITION_FADE_END + STORY_TRANSITION_REVEAL_START) / 2,
      );
      const revealStart = project(
        boundaryIndex,
        STORY_TRANSITION_REVEAL_START,
      );
      const reveal = project(
        boundaryIndex,
        (STORY_TRANSITION_REVEAL_START + 1) / 2,
      );

      expect(start).toMatchObject({
        boundaryIndex,
        interactiveIndex: null,
        lowerIndex: boundaryIndex,
        lowerOpacity: 1,
        phase: "outgoing-fade",
        transitionProgress: 0,
        upperIndex: boundaryIndex + 1,
        upperOpacity: 0,
        veilOpacity: 0,
      });
      expect(fade.phase).toBe("outgoing-fade");
      expect(fade.lowerOpacity).toBeCloseTo(0.5);
      expect(fade.upperOpacity).toBe(0);
      expect(fade.veilOpacity).toBeCloseTo(0.5);
      expect(holdStart).toMatchObject({
        lowerOpacity: 0,
        phase: "black-hold",
        upperOpacity: 0,
        veilOpacity: 1,
      });
      expect(hold).toMatchObject({
        lowerOpacity: 0,
        phase: "black-hold",
        upperOpacity: 0,
        veilOpacity: 1,
      });
      expect(revealStart).toMatchObject({
        lowerOpacity: 0,
        phase: "incoming-reveal",
        upperOpacity: 0,
        veilOpacity: 1,
      });
      expect(reveal.phase).toBe("incoming-reveal");
      expect(reveal.lowerOpacity).toBe(0);
      expect(reveal.upperOpacity).toBeCloseTo(0.5);
      expect(reveal.veilOpacity).toBeCloseTo(0.5);

      for (let step = 0; step < 100; step += 1) {
        const state = project(boundaryIndex, step / 100);
        expect(state.lowerOpacity + state.upperOpacity).toBeLessThanOrEqual(1);
        expect(
          state.lowerOpacity > 0 && state.upperOpacity > 0,
        ).toBe(false);
      }
    },
  );

  it("is reversible because visual state is a pure position projection", () => {
    const positions = [0, 0.2, 0.4, 0.51, 0.62, 0.8, 0.999];
    const forward = positions.map((progress) => project(3, progress));
    const reverse = [...positions]
      .reverse()
      .map((progress) => project(3, progress))
      .reverse();

    expect(reverse).toEqual(forward);
  });

  it("holds black when the side that would be visible is not ready", () => {
    const blockedLower = deriveStoryTransitionState({
      lowerReady: false,
      overallProgress: progressAtTransition(0, 0.2),
      upperReady: true,
    });
    const blockedUpper = deriveStoryTransitionState({
      lowerReady: true,
      overallProgress: progressAtTransition(0, 0.8),
      upperReady: false,
    });
    const readyUpper = deriveStoryTransitionState({
      lowerReady: true,
      overallProgress: progressAtTransition(0, 0.8),
      upperReady: true,
    });

    expect(blockedLower).toMatchObject({
      lowerOpacity: 0,
      upperOpacity: 0,
      veilOpacity: 1,
    });
    expect(blockedUpper).toMatchObject({
      lowerOpacity: 0,
      upperOpacity: 0,
      veilOpacity: 1,
    });
    expect(readyUpper.upperOpacity).toBeGreaterThan(0);
    expect(readyUpper.veilOpacity).toBeLessThan(1);
  });

  it("swaps ownership only inside the black hold and resists boundary noise", () => {
    let previousOwnerIndex = 2;
    const forwardNoise = [
      STORY_OWNER_FORWARD_THRESHOLD - 0.005,
      STORY_OWNER_FORWARD_THRESHOLD + 0.004,
      STORY_OWNER_FORWARD_THRESHOLD - 0.003,
      STORY_OWNER_FORWARD_THRESHOLD + 0.006,
    ];
    const forwardOwners: number[] = [];

    for (const transitionProgress of forwardNoise) {
      const state = deriveStoryTransitionState({
        overallProgress: progressAtTransition(2, transitionProgress),
        previousOwnerIndex,
      });
      forwardOwners.push(state.ownerIndex);
      if (state.ownerIndex !== previousOwnerIndex) {
        expect(state.phase).toBe("black-hold");
        expect(state.veilOpacity).toBe(1);
      }
      previousOwnerIndex = state.ownerIndex;
    }

    expect(forwardOwners).toEqual([2, 3, 3, 3]);

    const reverseNoise = [
      STORY_OWNER_REVERSE_THRESHOLD + 0.005,
      STORY_OWNER_REVERSE_THRESHOLD - 0.004,
      STORY_OWNER_REVERSE_THRESHOLD + 0.003,
      STORY_OWNER_REVERSE_THRESHOLD - 0.006,
    ];
    const reverseOwners: number[] = [];

    for (const transitionProgress of reverseNoise) {
      const state = deriveStoryTransitionState({
        overallProgress: progressAtTransition(2, transitionProgress),
        previousOwnerIndex,
      });
      reverseOwners.push(state.ownerIndex);
      if (state.ownerIndex !== previousOwnerIndex) {
        expect(state.phase).toBe("black-hold");
        expect(state.veilOpacity).toBe(1);
      }
      previousOwnerIndex = state.ownerIndex;
    }

    expect(reverseOwners).toEqual([3, 2, 2, 2]);
  });

  it.each(Array.from({ length: STORY_BOUNDARY_COUNT }, (_, index) => index))(
    "keeps stateful ownership stable through forward and reverse noise at boundary %i",
    (boundaryIndex) => {
      let owner = boundaryIndex;
      const forwardOwners: number[] = [];
      for (const progress of [
        STORY_OWNER_FORWARD_THRESHOLD - 0.006,
        STORY_OWNER_FORWARD_THRESHOLD + 0.004,
        STORY_OWNER_FORWARD_THRESHOLD - 0.003,
        STORY_OWNER_FORWARD_THRESHOLD + 0.008,
      ]) {
        const state = deriveStoryTransitionState({
          overallProgress: progressAtTransition(boundaryIndex, progress),
          previousOwnerIndex: owner,
        });
        if (state.ownerIndex !== owner) {
          expect(state).toMatchObject({
            lowerOpacity: 0,
            phase: "black-hold",
            upperOpacity: 0,
            veilOpacity: 1,
          });
        }
        owner = state.ownerIndex;
        forwardOwners.push(owner);
      }
      expect(forwardOwners).toEqual([
        boundaryIndex,
        boundaryIndex + 1,
        boundaryIndex + 1,
        boundaryIndex + 1,
      ]);

      const reverseOwners: number[] = [];
      for (const progress of [
        STORY_OWNER_REVERSE_THRESHOLD + 0.006,
        STORY_OWNER_REVERSE_THRESHOLD - 0.004,
        STORY_OWNER_REVERSE_THRESHOLD + 0.003,
        STORY_OWNER_REVERSE_THRESHOLD - 0.008,
      ]) {
        const state = deriveStoryTransitionState({
          overallProgress: progressAtTransition(boundaryIndex, progress),
          previousOwnerIndex: owner,
        });
        if (state.ownerIndex !== owner) {
          expect(state).toMatchObject({
            lowerOpacity: 0,
            phase: "black-hold",
            upperOpacity: 0,
            veilOpacity: 1,
          });
        }
        owner = state.ownerIndex;
        reverseOwners.push(owner);
      }
      expect(reverseOwners).toEqual([
        boundaryIndex + 1,
        boundaryIndex,
        boundaryIndex,
        boundaryIndex,
      ]);
    },
  );

  it("forces a black frame when a fast jump crosses ownership outside the hold", () => {
    const forwardJump = deriveStoryTransitionState({
      overallProgress: progressAtTransition(4, 0.9),
      previousOwnerIndex: 4,
    });
    const reverseJump = deriveStoryTransitionState({
      overallProgress: progressAtTransition(4, 0.1),
      previousOwnerIndex: 5,
    });

    expect(forwardJump).toMatchObject({
      lowerOpacity: 0,
      ownerIndex: 5,
      phase: "black-hold",
      upperOpacity: 0,
      veilOpacity: 1,
    });
    expect(reverseJump).toMatchObject({
      lowerOpacity: 0,
      ownerIndex: 4,
      phase: "black-hold",
      upperOpacity: 0,
      veilOpacity: 1,
    });
  });

  it("keeps the final chapter stable without a phantom ninth boundary", () => {
    expect(deriveStoryTransitionState({ overallProgress: 1 })).toMatchObject({
      boundaryIndex: null,
      interactiveIndex: 8,
      lowerIndex: 8,
      lowerOpacity: 1,
      ownerIndex: 8,
      phase: "stable",
      upperIndex: 8,
      upperOpacity: 0,
      veilOpacity: 0,
    });
  });

  it("supports a measured final chapter anchor before story end", () => {
    const measured = [0, 0.08, 0.17, 0.29, 0.42, 0.56, 0.7, 0.82, 0.9];
    const finalChapter = deriveStoryTransitionState({
      boundaries: measured,
      overallProgress: 0.95,
    });

    expect(isNormalizedStoryBoundaryList(measured)).toBe(true);
    expect(finalChapter).toMatchObject({
      boundaryIndex: null,
      interactiveIndex: 8,
      lowerIndex: 8,
      ownerIndex: 8,
      phase: "stable",
      veilOpacity: 0,
    });
    expect(finalChapter.segmentProgress).toBeCloseTo(0.5);
  });

  it("keeps an unready stable scene black and gates a distant ownership jump", () => {
    const unready = deriveStoryTransitionState({
      lowerReady: false,
      overallProgress: 0,
    });
    const jumped = deriveStoryTransitionState({
      overallProgress: 0.75,
      previousOwnerIndex: 0,
    });
    const settled = deriveStoryTransitionState({
      overallProgress: 0.75,
      previousOwnerIndex: jumped.ownerIndex,
    });

    expect(unready).toMatchObject({
      interactiveIndex: null,
      lowerOpacity: 0,
      phase: "stable",
      veilOpacity: 1,
    });
    expect(jumped).toMatchObject({
      interactiveIndex: null,
      lowerOpacity: 0,
      ownerIndex: 6,
      phase: "black-hold",
      veilOpacity: 1,
    });
    expect(settled).toMatchObject({
      interactiveIndex: 6,
      lowerOpacity: 1,
      ownerIndex: 6,
      phase: "stable",
      veilOpacity: 0,
    });
  });

  it("clamps invalid input and falls back from malformed boundary lists", () => {
    const malformed = [0, 0.2, 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 1];
    const invalidProgress = deriveStoryTransitionState({
      boundaries: malformed,
      overallProgress: Number.NaN,
      previousOwnerIndex: 99,
    });
    const overrun = deriveStoryTransitionState({
      boundaries: malformed,
      overallProgress: 12,
      previousOwnerIndex: -1,
    });

    expect(invalidProgress).toMatchObject({
      boundaryIndex: null,
      lowerIndex: 0,
      ownerIndex: 0,
      phase: "stable",
      segmentProgress: 0,
    });
    expect(overrun).toMatchObject({
      boundaryIndex: null,
      lowerIndex: 8,
      ownerIndex: 8,
      phase: "stable",
      segmentProgress: 1,
    });
  });

  it("reuses caller-owned output storage without retaining stale fields", () => {
    const reusable: StoryTransitionState = {
      boundaryIndex: 7,
      interactiveIndex: null,
      lowerIndex: 7,
      lowerOpacity: 0,
      ownerIndex: 8,
      phase: "black-hold",
      segmentProgress: 1,
      transitionProgress: 1,
      upperIndex: 8,
      upperOpacity: 0,
      veilOpacity: 1,
    };
    const transition = deriveStoryTransitionState(
      { overallProgress: progressAtTransition(0, 0.5) },
      reusable,
    );
    const stable = deriveStoryTransitionState(
      { overallProgress: 0.01 },
      reusable,
    );

    expect(transition).toBe(reusable);
    expect(stable).toBe(reusable);
    expect(stable).toMatchObject({
      boundaryIndex: null,
      interactiveIndex: 0,
      lowerIndex: 0,
      lowerOpacity: 1,
      ownerIndex: 0,
      phase: "stable",
      transitionProgress: 0,
      upperIndex: 0,
      upperOpacity: 0,
      veilOpacity: 0,
    });
  });
});
