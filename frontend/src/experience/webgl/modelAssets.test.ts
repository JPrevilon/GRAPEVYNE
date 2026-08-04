import { describe, expect, it } from "vitest";

import {
  ACTIVE_LABEL_PATHS,
  BOTTLE_LABEL_PATHS,
  BOTTLE_MODEL_PATHS,
  MESHY_BOTTLE_MODEL_PATHS,
  MESHY_GRAPE_MODEL_PATHS,
  STORY_SUBJECT_FALLBACK_PATHS,
} from "./modelAssets";

describe("Prompt 10A1R model registry", () => {
  it("selects the exact desktop/mobile Meshy bottle and grape assets", () => {
    expect(MESHY_BOTTLE_MODEL_PATHS).toEqual({
      high: "/assets/models/grapevyne-meshy-bottle.desktop.glb",
      standard: "/assets/models/grapevyne-meshy-bottle.mobile.glb",
    });
    expect(MESHY_GRAPE_MODEL_PATHS).toEqual({
      high: "/assets/models/grapevyne-meshy-grapes.desktop.glb",
      standard: "/assets/models/grapevyne-meshy-grapes.mobile.glb",
    });
  });

  it("retains legacy bottle rollback assets and exact label/fallback paths", () => {
    expect(BOTTLE_MODEL_PATHS.high).toContain("grapevyne-master-bottle.glb");
    expect(BOTTLE_MODEL_PATHS.standard).toContain(
      "grapevyne-master-bottle-mobile.glb",
    );
    expect(ACTIVE_LABEL_PATHS.front).toBe(
      "/assets/labels/grapevyne-label-front-red.png",
    );
    expect(BOTTLE_LABEL_PATHS).toEqual({
      red: "/assets/labels/grapevyne-label-front-red.png",
      white: "/assets/labels/grapevyne-label-front-white.png",
      sparkling: "/assets/labels/grapevyne-label-front-sparkling.png",
      rose: "/assets/labels/grapevyne-label-front-rose.png",
    });
    expect(STORY_SUBJECT_FALLBACK_PATHS.grapes).toBe(
      "/assets/models/fallbacks/grapevyne-meshy-grapes.png",
    );
  });
});
