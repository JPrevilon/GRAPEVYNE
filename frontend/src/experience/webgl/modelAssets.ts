import type { WebGLQualityTier } from "./qualityTier";

export const BOTTLE_MODEL_PATHS: Record<WebGLQualityTier, string> = {
  high: "/assets/models/grapevyne-master-bottle.glb",
  standard: "/assets/models/grapevyne-master-bottle-mobile.glb",
};

export type BottleLabelFamily = "red" | "white" | "sparkling" | "rose";

export const BOTTLE_LABEL_PATHS: Record<BottleLabelFamily, string> = {
  red: "/assets/labels/grapevyne-label-front-red.png",
  white: "/assets/labels/grapevyne-label-front-white.png",
  sparkling: "/assets/labels/grapevyne-label-front-sparkling.png",
  rose: "/assets/labels/grapevyne-label-front-rose.png",
};

export const ACTIVE_LABEL_PATHS = {
  back: "/assets/labels/grapevyne-label-back.png",
  front: BOTTLE_LABEL_PATHS.red,
} as const;
