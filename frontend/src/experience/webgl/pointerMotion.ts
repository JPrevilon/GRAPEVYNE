import { MathUtils } from "three";

import { MAX_POINTER_PITCH, MAX_POINTER_YAW } from "./sceneTargets";

export function getClampedPointerRotation(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const normalizedX = MathUtils.clamp(
    (clientX / Math.max(viewportWidth, 1)) * 2 - 1,
    -1,
    1,
  );
  const normalizedY = MathUtils.clamp(
    (clientY / Math.max(viewportHeight, 1)) * 2 - 1,
    -1,
    1,
  );

  return {
    pitch: normalizedY * -MAX_POINTER_PITCH,
    yaw: normalizedX * MAX_POINTER_YAW,
  };
}
