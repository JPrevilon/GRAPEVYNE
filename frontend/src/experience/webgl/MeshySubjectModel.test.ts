import { describe, expect, it } from "vitest";

import {
  MESHY_LABEL_FIT,
  createCurvedLabelGeometry,
} from "./meshyLabelGeometry";

describe("MeshySubjectModel exact label fit", () => {
  it("wraps the approved artwork tightly around the normalized bottle body", () => {
    expect(MESHY_LABEL_FIT.maskRadius).toBeGreaterThan(
      MESHY_LABEL_FIT.bodyRadius,
    );
    expect(
      MESHY_LABEL_FIT.maskRadius - MESHY_LABEL_FIT.bodyRadius,
    ).toBeLessThanOrEqual(0.006);
    expect(
      MESHY_LABEL_FIT.artworkRadius - MESHY_LABEL_FIT.maskRadius,
    ).toBeLessThanOrEqual(0.005);

    const wrappedAspect =
      (2 *
        MESHY_LABEL_FIT.artworkHalfAngle *
        MESHY_LABEL_FIT.artworkRadius) /
      MESHY_LABEL_FIT.height;
    expect(wrappedAspect).toBeCloseTo(2400 / 3300, 1);
  });

  it("builds a front-facing indexed curved label with stable UV coverage", () => {
    const geometry = createCurvedLabelGeometry(32);
    const positions = geometry.getAttribute("position");
    const uvs = geometry.getAttribute("uv");

    expect(positions.count).toBe(66);
    expect(uvs.count).toBe(66);
    expect(geometry.index?.count).toBe(192);
    expect(Math.min(...Array.from(uvs.array))).toBe(0);
    expect(Math.max(...Array.from(uvs.array))).toBe(1);

    for (let index = 0; index < positions.count; index += 1) {
      expect(
        Math.hypot(positions.getX(index), positions.getZ(index)),
      ).toBeCloseTo(MESHY_LABEL_FIT.artworkRadius, 5);
    }

    geometry.computeBoundingBox();
    expect(
      (geometry.boundingBox?.max.y ?? 0) -
        (geometry.boundingBox?.min.y ?? 0),
    ).toBeCloseTo(MESHY_LABEL_FIT.height, 5);
    geometry.dispose();
  });
});
