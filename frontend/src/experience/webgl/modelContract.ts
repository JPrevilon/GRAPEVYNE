import type { Object3D } from "three";

export const REQUIRED_BOTTLE_NODES = [
  "Bottle_Glass",
  "Wine_Liquid",
  "Cork",
  "Capsule",
  "Label_Front",
  "Label_Back",
  "Condensation",
] as const;

export type RequiredBottleNode = (typeof REQUIRED_BOTTLE_NODES)[number];

export function getMissingBottleNodes(
  scene: Pick<Object3D, "getObjectByName">,
) {
  return REQUIRED_BOTTLE_NODES.filter(
    (nodeName) => scene.getObjectByName(nodeName) === undefined,
  );
}

export function assertBottleModelContract(
  scene: Pick<Object3D, "getObjectByName">,
) {
  const missingNodes = getMissingBottleNodes(scene);

  if (missingNodes.length > 0) {
    throw new Error(
      `Bottle model is missing required nodes: ${missingNodes.join(", ")}`,
    );
  }
}
