import { describe, expect, it } from "vitest";

import {
  SUBJECT_KEYBOARD_PITCH_INCREMENT,
  SUBJECT_KEYBOARD_YAW_INCREMENT,
  SUBJECT_PITCH_LIMITS,
  applySubjectDragDelta,
  applySubjectKeyIncrement,
  createSubjectInteractionState,
  resetSubjectInteraction,
  resetSubjectInteractionWhenHidden,
  setSubjectDragging,
} from "./subjectInteraction";

describe("story subject interaction math", () => {
  it("creates distinct bottle and grape rotation records", () => {
    const state = createSubjectInteractionState();

    expect(state.bottle).not.toBe(state.grapes);
    expect(state.bottle).toEqual({
      dragging: false,
      renderedPitch: 0,
      renderedYaw: 0,
      targetPitch: 0,
      targetYaw: 0,
      userModified: false,
    });
    expect(state.grapes).toEqual(state.bottle);
  });

  it("keeps yaw unbounded while clamping subject-specific drag pitch", () => {
    const initial = createSubjectInteractionState();
    const bottle = applySubjectDragDelta(
      initial.bottle,
      "bottle",
      4_000,
      -4_000,
    );
    const grapes = applySubjectDragDelta(
      initial.grapes,
      "grapes",
      -4_000,
      4_000,
    );

    expect(bottle.targetYaw).toBeGreaterThan(Math.PI * 2);
    expect(bottle.targetPitch).toBe(SUBJECT_PITCH_LIMITS.bottle);
    expect(grapes.targetYaw).toBeLessThan(-Math.PI * 2);
    expect(grapes.targetPitch).toBe(-SUBJECT_PITCH_LIMITS.grapes);
    expect(bottle.userModified).toBe(true);
    expect(grapes.userModified).toBe(true);
  });

  it("applies fixed keyboard increments and clamps repeated pitch input", () => {
    let bottle = createSubjectInteractionState().bottle;

    bottle = applySubjectKeyIncrement(bottle, "bottle", "ArrowRight");
    bottle = applySubjectKeyIncrement(bottle, "bottle", "ArrowUp");
    expect(bottle.targetYaw).toBeCloseTo(SUBJECT_KEYBOARD_YAW_INCREMENT);
    expect(bottle.targetPitch).toBeCloseTo(
      SUBJECT_KEYBOARD_PITCH_INCREMENT,
    );

    for (let index = 0; index < 30; index += 1) {
      bottle = applySubjectKeyIncrement(bottle, "bottle", "ArrowUp");
    }
    expect(bottle.targetPitch).toBe(SUBJECT_PITCH_LIMITS.bottle);

    let grapes = createSubjectInteractionState().grapes;
    for (let index = 0; index < 30; index += 1) {
      grapes = applySubjectKeyIncrement(grapes, "grapes", "ArrowDown");
    }
    expect(grapes.targetPitch).toBe(-SUBJECT_PITCH_LIMITS.grapes);
  });

  it("keeps the other subject isolated when one record changes", () => {
    const state = createSubjectInteractionState();
    const originalGrapes = state.grapes;

    state.bottle = applySubjectDragDelta(state.bottle, "bottle", 240, 10);

    expect(state.bottle.targetYaw).not.toBe(0);
    expect(state.grapes).toBe(originalGrapes);
    expect(state.grapes.targetYaw).toBe(0);
    expect(state.grapes.targetPitch).toBe(0);
  });

  it("marks drag activity without treating activation as a pose change", () => {
    const record = createSubjectInteractionState().bottle;
    const dragging = setSubjectDragging(record, true);

    expect(dragging.dragging).toBe(true);
    expect(dragging.userModified).toBe(false);
    expect(setSubjectDragging(dragging, true)).toBe(dragging);
  });

  it("explicitly resets targets while retaining rendered values for damping", () => {
    const current = {
      dragging: true,
      renderedPitch: 0.2,
      renderedYaw: 1.4,
      targetPitch: 0.3,
      targetYaw: Math.PI,
      userModified: true,
    };

    expect(resetSubjectInteraction(current)).toEqual({
      dragging: false,
      renderedPitch: 0.2,
      renderedYaw: 1.4,
      targetPitch: 0,
      targetYaw: 0,
      userModified: false,
    });
  });

  it("automatically resets all pose values only while fully hidden", () => {
    const current = {
      dragging: true,
      renderedPitch: 0.2,
      renderedYaw: 1.4,
      targetPitch: 0.3,
      targetYaw: Math.PI,
      userModified: true,
    };

    expect(resetSubjectInteractionWhenHidden(current, false)).toBe(current);
    expect(resetSubjectInteractionWhenHidden(current, true)).toEqual(
      createSubjectInteractionState().bottle,
    );
  });
});
