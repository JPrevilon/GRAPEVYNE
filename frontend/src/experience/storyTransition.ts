export const STORY_CHAPTER_COUNT = 9;
export const STORY_BOUNDARY_COUNT = STORY_CHAPTER_COUNT - 1;

export const STORY_TRANSITION_SEGMENT_START = 0.7;
export const STORY_TRANSITION_SEGMENT_LENGTH =
  1 - STORY_TRANSITION_SEGMENT_START;
export const STORY_TRANSITION_FADE_END = 0.4;
export const STORY_TRANSITION_REVEAL_START = 0.62;

// Both ownership thresholds sit inside the fully black interval. Keeping
// separate thresholds prevents tiny progress noise from alternating the owner.
export const STORY_OWNER_REVERSE_THRESHOLD = 0.46;
export const STORY_OWNER_DEFAULT_THRESHOLD = 0.51;
export const STORY_OWNER_FORWARD_THRESHOLD = 0.56;

const TRANSITION_BOUNDARY_EPSILON = 1e-12;

export const DEFAULT_STORY_BOUNDARIES = [
  0,
  0.125,
  0.25,
  0.375,
  0.5,
  0.625,
  0.75,
  0.875,
  1,
] as const;

export type StoryTransitionPhase =
  | "stable"
  | "outgoing-fade"
  | "black-hold"
  | "incoming-reveal";

export interface StoryTransitionInput {
  /** Nine normalized chapter anchors; the final anchor may precede story end. */
  boundaries?: readonly number[];
  /** Readiness of the lower scene in the resolved pair. */
  lowerReady?: boolean;
  /** Normalized progress across the complete story. */
  overallProgress: number;
  /** The owner returned by the preceding projection, when one exists. */
  previousOwnerIndex?: number | null;
  /** Readiness of the upper scene in the resolved pair. */
  upperReady?: boolean;
}

export interface StoryTransitionState {
  boundaryIndex: number | null;
  interactiveIndex: number | null;
  lowerIndex: number;
  lowerOpacity: number;
  ownerIndex: number;
  phase: StoryTransitionPhase;
  segmentProgress: number;
  transitionProgress: number;
  upperIndex: number;
  upperOpacity: number;
  veilOpacity: number;
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function snapTransitionProgress(value: number) {
  const progress = clampUnit(value);
  if (Math.abs(progress) <= TRANSITION_BOUNDARY_EPSILON) return 0;
  if (Math.abs(progress - 1) <= TRANSITION_BOUNDARY_EPSILON) return 1;
  if (
    Math.abs(progress - STORY_TRANSITION_FADE_END) <=
    TRANSITION_BOUNDARY_EPSILON
  ) {
    return STORY_TRANSITION_FADE_END;
  }
  if (
    Math.abs(progress - STORY_TRANSITION_REVEAL_START) <=
    TRANSITION_BOUNDARY_EPSILON
  ) {
    return STORY_TRANSITION_REVEAL_START;
  }
  return progress;
}

function snapOpacity(value: number) {
  const opacity = clampUnit(value);
  if (opacity <= TRANSITION_BOUNDARY_EPSILON) return 0;
  if (1 - opacity <= TRANSITION_BOUNDARY_EPSILON) return 1;
  return opacity;
}

function isValidOwnerIndex(value: number | null | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < STORY_CHAPTER_COUNT
  );
}

export function isNormalizedStoryBoundaryList(
  boundaries: readonly number[] | undefined,
): boundaries is readonly number[] {
  if (boundaries?.length !== STORY_CHAPTER_COUNT) return false;
  if (boundaries[0] !== 0) {
    return false;
  }

  let previous = boundaries[0];
  for (let index = 1; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];
    if (
      boundary === undefined ||
      !Number.isFinite(boundary) ||
      boundary <= previous ||
      boundary < 0 ||
      boundary > 1
    ) {
      return false;
    }
    previous = boundary;
  }

  return true;
}

function getBoundaries(boundaries: readonly number[] | undefined) {
  return isNormalizedStoryBoundaryList(boundaries)
    ? boundaries
    : DEFAULT_STORY_BOUNDARIES;
}

function getSegmentIndex(progress: number, boundaries: readonly number[]) {
  if (progress >= 1) return STORY_BOUNDARY_COUNT;

  let index = 0;
  while (
    index < STORY_BOUNDARY_COUNT &&
    progress >= (boundaries[index + 1] ?? 1)
  ) {
    index += 1;
  }
  return index;
}

function getSegmentProgress(
  progress: number,
  segmentIndex: number,
  boundaries: readonly number[],
) {
  if (segmentIndex >= STORY_BOUNDARY_COUNT) {
    const start = boundaries[STORY_BOUNDARY_COUNT] ?? 1;
    return start >= 1 ? 1 : clampUnit((progress - start) / (1 - start));
  }
  const start = boundaries[segmentIndex] ?? 0;
  const end = boundaries[segmentIndex + 1] ?? 1;
  return clampUnit((progress - start) / (end - start));
}

function getTransitionOwner(
  transitionProgress: number,
  lowerIndex: number,
  upperIndex: number,
  previousOwnerIndex: number | null | undefined,
) {
  if (previousOwnerIndex === lowerIndex) {
    return transitionProgress >= STORY_OWNER_FORWARD_THRESHOLD
      ? upperIndex
      : lowerIndex;
  }
  if (previousOwnerIndex === upperIndex) {
    return transitionProgress <= STORY_OWNER_REVERSE_THRESHOLD
      ? lowerIndex
      : upperIndex;
  }
  return transitionProgress >= STORY_OWNER_DEFAULT_THRESHOLD
    ? upperIndex
    : lowerIndex;
}

function createOutput(): StoryTransitionState {
  return {
    boundaryIndex: null,
    interactiveIndex: 0,
    lowerIndex: 0,
    lowerOpacity: 1,
    ownerIndex: 0,
    phase: "stable",
    segmentProgress: 0,
    transitionProgress: 0,
    upperIndex: 0,
    upperOpacity: 0,
    veilOpacity: 0,
  };
}

/**
 * Projects one complete story position into a single media/subject ownership
 * state. Pass the preceding output back as `reusableOutput` to avoid allocating
 * an object in a scroll-driven frame scheduler.
 */
export function deriveStoryTransitionState(
  input: StoryTransitionInput,
  reusableOutput?: StoryTransitionState,
): StoryTransitionState {
  const output = reusableOutput ?? createOutput();
  const boundaries = getBoundaries(input.boundaries);
  const overallProgress = clampUnit(input.overallProgress);
  const segmentIndex = getSegmentIndex(overallProgress, boundaries);
  const segmentProgress = getSegmentProgress(
    overallProgress,
    segmentIndex,
    boundaries,
  );
  const previousOwnerIndex = isValidOwnerIndex(input.previousOwnerIndex)
    ? input.previousOwnerIndex
    : null;

  output.segmentProgress = segmentProgress;

  if (
    segmentIndex === STORY_BOUNDARY_COUNT ||
    segmentProgress < STORY_TRANSITION_SEGMENT_START
  ) {
    const stableIndex = Math.min(segmentIndex, STORY_CHAPTER_COUNT - 1);
    const ready = input.lowerReady !== false;
    const ownershipChanged =
      previousOwnerIndex !== null && previousOwnerIndex !== stableIndex;

    output.boundaryIndex = null;
    output.interactiveIndex =
      ready && !ownershipChanged ? stableIndex : null;
    output.lowerIndex = stableIndex;
    output.lowerOpacity = ready && !ownershipChanged ? 1 : 0;
    output.ownerIndex = stableIndex;
    output.phase = ownershipChanged ? "black-hold" : "stable";
    output.transitionProgress = 0;
    output.upperIndex = stableIndex;
    output.upperOpacity = 0;
    output.veilOpacity = ready && !ownershipChanged ? 0 : 1;
    return output;
  }

  const lowerIndex = segmentIndex;
  const upperIndex = segmentIndex + 1;
  const transitionProgress = snapTransitionProgress(
    (segmentProgress - STORY_TRANSITION_SEGMENT_START) /
      STORY_TRANSITION_SEGMENT_LENGTH,
  );
  const ownerIndex = getTransitionOwner(
    transitionProgress,
    lowerIndex,
    upperIndex,
    previousOwnerIndex,
  );
  let phase: StoryTransitionPhase;
  let lowerOpacity = 0;
  let upperOpacity = 0;

  if (transitionProgress < STORY_TRANSITION_FADE_END) {
    phase = "outgoing-fade";
    lowerOpacity =
      1 - transitionProgress / STORY_TRANSITION_FADE_END;
  } else if (transitionProgress < STORY_TRANSITION_REVEAL_START) {
    phase = "black-hold";
  } else {
    phase = "incoming-reveal";
    upperOpacity =
      (transitionProgress - STORY_TRANSITION_REVEAL_START) /
      (1 - STORY_TRANSITION_REVEAL_START);
  }

  if (input.lowerReady === false && lowerOpacity > 0) lowerOpacity = 0;
  if (input.upperReady === false && upperOpacity > 0) upperOpacity = 0;

  // A large progress jump can cross both hysteresis thresholds between two
  // rendered frames. Project one fully black frame around that ownership swap
  // instead of revealing the newly owned side immediately.
  const ownershipChanged =
    previousOwnerIndex !== null &&
    previousOwnerIndex !== ownerIndex &&
    phase !== "black-hold";
  if (ownershipChanged) {
    phase = "black-hold";
    lowerOpacity = 0;
    upperOpacity = 0;
  }

  output.boundaryIndex = segmentIndex;
  output.interactiveIndex = null;
  output.lowerIndex = lowerIndex;
  output.lowerOpacity = snapOpacity(lowerOpacity);
  output.ownerIndex = ownerIndex;
  output.phase = phase;
  output.transitionProgress = transitionProgress;
  output.upperIndex = upperIndex;
  output.upperOpacity = snapOpacity(upperOpacity);
  output.veilOpacity = snapOpacity(
    1 - Math.max(output.lowerOpacity, output.upperOpacity),
  );
  return output;
}
