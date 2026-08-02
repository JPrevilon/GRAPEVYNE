import type { StoryChapter } from "@/experience/storyChapters";

import type { WebGLQualityTier } from "./qualityTier";

type Vector3Tuple = readonly [number, number, number];

export interface BottleSceneTarget {
  decoration: number;
  keyLight: number;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: number;
  visible: boolean;
}

export const MAX_POINTER_YAW = (4 * Math.PI) / 180;
export const MAX_POINTER_PITCH = (2 * Math.PI) / 180;

const desktopTargets = {
  atlas: {
    decoration: 0.25,
    keyLight: 3.8,
    position: [-1.58, -1.33, -0.08],
    rotation: [0.01, -0.34, -0.02],
    scale: 0.92,
    visible: true,
  },
  cellar: {
    decoration: 0.3,
    keyLight: 3.1,
    position: [1.72, -1.34, -0.16],
    rotation: [-0.02, 0.42, 0.01],
    scale: 1.02,
    visible: true,
  },
  discovery: {
    decoration: 0.55,
    keyLight: 3.3,
    position: [1.83, -1.38, -0.12],
    rotation: [0.01, -0.27, -0.01],
    scale: 1.1,
    visible: true,
  },
  finale: {
    decoration: 0.7,
    keyLight: 2.8,
    position: [0.92, -1.42, -0.24],
    rotation: [0, 0.12, 0],
    scale: 1.08,
    visible: true,
  },
  hero: {
    decoration: 1,
    keyLight: 3.7,
    position: [1.65, -1.72, 0],
    rotation: [0, 0.1, -0.015],
    scale: 1.12,
    visible: true,
  },
  match: {
    decoration: 0.62,
    keyLight: 4.2,
    position: [0.92, -1.3, -0.08],
    rotation: [0.015, 0.36, 0.015],
    scale: 1.13,
    visible: true,
  },
  memory: {
    decoration: 0.38,
    keyLight: 3.5,
    position: [1.67, -1.32, -0.08],
    rotation: [-0.01, -0.44, 0.015],
    scale: 1.05,
    visible: true,
  },
  portal: {
    decoration: 0.44,
    keyLight: 4.5,
    position: [-1.48, -1.34, -0.04],
    rotation: [0.02, 0.52, -0.01],
    scale: 1.02,
    visible: true,
  },
  taste: {
    decoration: 0.34,
    keyLight: 4,
    position: [1.55, -1.36, -0.1],
    rotation: [-0.015, -0.16, 0.012],
    scale: 0.98,
    visible: true,
  },
} satisfies Record<StoryChapter, BottleSceneTarget>;

const mobileTargets = {
  atlas: {
    decoration: 0,
    keyLight: 2.8,
    position: [-0.14, -0.48, -0.3],
    rotation: [0, -0.2, 0],
    scale: 0.66,
    visible: true,
  },
  cellar: {
    decoration: 0,
    keyLight: 2.5,
    position: [0.17, -0.5, -0.34],
    rotation: [0, 0.25, 0],
    scale: 0.72,
    visible: true,
  },
  discovery: {
    decoration: 0,
    keyLight: 2.6,
    position: [0.16, -0.5, -0.32],
    rotation: [0, -0.16, 0],
    scale: 0.77,
    visible: true,
  },
  finale: {
    decoration: 0,
    keyLight: 2.3,
    position: [0, -0.55, -0.4],
    rotation: [0, 0.08, 0],
    scale: 0.76,
    visible: true,
  },
  hero: {
    decoration: 0,
    keyLight: 2.9,
    position: [0, -0.49, -0.26],
    rotation: [0, 0.08, 0],
    scale: 0.8,
    visible: true,
  },
  match: {
    decoration: 0,
    keyLight: 3,
    position: [0.15, -0.47, -0.3],
    rotation: [0, 0.28, 0],
    scale: 0.79,
    visible: true,
  },
  memory: {
    decoration: 0,
    keyLight: 2.7,
    position: [0.14, -0.49, -0.32],
    rotation: [0, -0.3, 0],
    scale: 0.72,
    visible: true,
  },
  portal: {
    decoration: 0,
    keyLight: 3.1,
    position: [-0.15, -0.47, -0.3],
    rotation: [0, 0.32, 0],
    scale: 0.72,
    visible: true,
  },
  taste: {
    decoration: 0,
    keyLight: 2.9,
    position: [0.12, -0.5, -0.3],
    rotation: [0, -0.12, 0],
    scale: 0.72,
    visible: true,
  },
} satisfies Record<StoryChapter, BottleSceneTarget>;

export const BOTTLE_SCENE_TARGETS: Record<
  WebGLQualityTier,
  Record<StoryChapter, BottleSceneTarget>
> = {
  high: desktopTargets,
  standard: mobileTargets,
};
