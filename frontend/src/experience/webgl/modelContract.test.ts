import { describe, expect, it } from "vitest";
import { Object3D } from "three";

import { ACTIVE_LABEL_PATHS, BOTTLE_MODEL_PATHS } from "./modelAssets";
import {
  assertBottleModelContract,
  getMissingBottleNodes,
  REQUIRED_BOTTLE_NODES,
} from "./modelContract";

function modelWithNodes(nodeNames: readonly string[]) {
  const model = new Object3D();

  nodeNames.forEach((nodeName) => {
    const node = new Object3D();
    node.name = nodeName;
    model.add(node);
  });

  return model;
}

describe("approved bottle model contract", () => {
  it("maps high and standard tiers to their exact local model paths", () => {
    expect(BOTTLE_MODEL_PATHS).toEqual({
      high: "/assets/models/grapevyne-master-bottle.glb",
      standard: "/assets/models/grapevyne-master-bottle-mobile.glb",
    });
    expect(ACTIVE_LABEL_PATHS).toEqual({
      back: "/assets/labels/grapevyne-label-back.png",
      front: "/assets/labels/grapevyne-label-front-red.png",
    });
    expect(Object.values(BOTTLE_MODEL_PATHS)).toHaveLength(2);
    expect(Object.values(BOTTLE_MODEL_PATHS).every((path) => path.startsWith("/assets/"))).toBe(
      true,
    );
  });

  it("accepts both models only when all seven stable node names exist", () => {
    expect(REQUIRED_BOTTLE_NODES).toEqual([
      "Bottle_Glass",
      "Wine_Liquid",
      "Cork",
      "Capsule",
      "Label_Front",
      "Label_Back",
      "Condensation",
    ]);

    const validModel = modelWithNodes(REQUIRED_BOTTLE_NODES);

    expect(getMissingBottleNodes(validModel)).toEqual([]);
    expect(() => assertBottleModelContract(validModel)).not.toThrow();
  });

  it("names every missing node in a deterministic loader error", () => {
    const partialModel = modelWithNodes(
      REQUIRED_BOTTLE_NODES.filter(
        (nodeName) => !["Label_Back", "Condensation"].includes(nodeName),
      ),
    );

    expect(getMissingBottleNodes(partialModel)).toEqual([
      "Label_Back",
      "Condensation",
    ]);
    expect(() => assertBottleModelContract(partialModel)).toThrow(
      "Bottle model is missing required nodes: Label_Back, Condensation",
    );
  });
});
