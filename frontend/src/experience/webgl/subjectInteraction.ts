export type InteractiveStorySubject = "bottle" | "grapes";

export interface SubjectInteractionRecord {
  dragging: boolean;
  renderedPitch: number;
  renderedYaw: number;
  targetPitch: number;
  targetYaw: number;
  userModified: boolean;
}

export interface SubjectInteractionState {
  bottle: SubjectInteractionRecord;
  control: {
    cancel: (() => void) | null;
    element: HTMLButtonElement | null;
    subject: InteractiveStorySubject | null;
  };
  grapes: SubjectInteractionRecord;
}

export type SubjectRotationKey =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp";

export const SUBJECT_DRAG_RADIANS_PER_PIXEL = Math.PI / 240;
export const SUBJECT_KEYBOARD_YAW_INCREMENT = Math.PI / 12;
export const SUBJECT_KEYBOARD_PITCH_INCREMENT = Math.PI / 36;

export const SUBJECT_PITCH_LIMITS = {
  bottle: (25 * Math.PI) / 180,
  grapes: (30 * Math.PI) / 180,
} as const satisfies Record<InteractiveStorySubject, number>;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(minimum, Math.min(maximum, value));
}

function createSubjectInteractionRecord(): SubjectInteractionRecord {
  return {
    dragging: false,
    renderedPitch: 0,
    renderedYaw: 0,
    targetPitch: 0,
    targetYaw: 0,
    userModified: false,
  };
}

export function createSubjectInteractionState(): SubjectInteractionState {
  return {
    bottle: createSubjectInteractionRecord(),
    control: { cancel: null, element: null, subject: null },
    grapes: createSubjectInteractionRecord(),
  };
}

export function setSubjectDragging(
  current: Readonly<SubjectInteractionRecord>,
  dragging: boolean,
): SubjectInteractionRecord {
  if (current.dragging === dragging) return current;
  return { ...current, dragging };
}

export function applySubjectDragDelta(
  current: Readonly<SubjectInteractionRecord>,
  subject: InteractiveStorySubject,
  deltaX: number,
  deltaY: number,
  radiansPerPixel = SUBJECT_DRAG_RADIANS_PER_PIXEL,
): SubjectInteractionRecord {
  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const safeSensitivity = Number.isFinite(radiansPerPixel)
    ? radiansPerPixel
    : SUBJECT_DRAG_RADIANS_PER_PIXEL;
  const targetYaw = current.targetYaw + safeDeltaX * safeSensitivity;
  const targetPitch = clamp(
    current.targetPitch - safeDeltaY * safeSensitivity,
    -SUBJECT_PITCH_LIMITS[subject],
    SUBJECT_PITCH_LIMITS[subject],
  );

  if (
    targetYaw === current.targetYaw &&
    targetPitch === current.targetPitch
  ) {
    return current;
  }

  return {
    ...current,
    targetPitch,
    targetYaw,
    userModified: true,
  };
}

export function applySubjectKeyIncrement(
  current: Readonly<SubjectInteractionRecord>,
  subject: InteractiveStorySubject,
  key: SubjectRotationKey,
): SubjectInteractionRecord {
  let yawDelta = 0;
  let pitchDelta = 0;

  switch (key) {
    case "ArrowLeft":
      yawDelta = -SUBJECT_KEYBOARD_YAW_INCREMENT;
      break;
    case "ArrowRight":
      yawDelta = SUBJECT_KEYBOARD_YAW_INCREMENT;
      break;
    case "ArrowUp":
      pitchDelta = SUBJECT_KEYBOARD_PITCH_INCREMENT;
      break;
    case "ArrowDown":
      pitchDelta = -SUBJECT_KEYBOARD_PITCH_INCREMENT;
      break;
  }

  return {
    ...current,
    targetPitch: clamp(
      current.targetPitch + pitchDelta,
      -SUBJECT_PITCH_LIMITS[subject],
      SUBJECT_PITCH_LIMITS[subject],
    ),
    targetYaw: current.targetYaw + yawDelta,
    userModified: true,
  };
}

/**
 * Explicit reset returns the requested pose to the chapter default. The render
 * loop retains its last rendered values so it can damp toward that default.
 */
export function resetSubjectInteraction(
  current: Readonly<SubjectInteractionRecord>,
): SubjectInteractionRecord {
  return {
    ...current,
    dragging: false,
    targetPitch: 0,
    targetYaw: 0,
    userModified: false,
  };
}

/**
 * Automatic resets are legal only while the subject is fully hidden. Unlike an
 * explicit reset, the hidden path may safely clear rendered values immediately.
 */
export function resetSubjectInteractionWhenHidden(
  current: Readonly<SubjectInteractionRecord>,
  hidden: boolean,
): SubjectInteractionRecord {
  if (!hidden) return current;

  if (
    !current.dragging &&
    current.renderedPitch === 0 &&
    current.renderedYaw === 0 &&
    current.targetPitch === 0 &&
    current.targetYaw === 0 &&
    !current.userModified
  ) {
    return current;
  }

  return createSubjectInteractionRecord();
}
