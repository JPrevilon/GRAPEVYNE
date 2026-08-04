import { cleanup, render } from "@testing-library/react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
  TorusGeometry,
  type Object3D,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_LABEL_PATHS,
  BOTTLE_LABEL_PATHS,
  BOTTLE_MODEL_PATHS,
} from "./modelAssets";
import { REQUIRED_BOTTLE_NODES } from "./modelContract";

const dreiMock = vi.hoisted(() => ({
  useGLTF: vi.fn(),
  useTexture: vi.fn(),
}));

vi.mock("@react-three/drei", () => ({
  useGLTF: dreiMock.useGLTF,
  useTexture: dreiMock.useTexture,
}));

import BottleModel from "./BottleModel";

interface LabelFixture {
  back: Texture;
  front: Texture;
}

const canvasContext = {
  drawImage: vi.fn(),
  imageSmoothingEnabled: false,
  imageSmoothingQuality: "low",
};

function createGeometry(nodeName: string) {
  const geometry = new BufferGeometry();

  if (nodeName === "Label_Front" || nodeName === "Label_Back") {
    const y = nodeName === "Label_Front" ? -0.372 : 0.372;
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          -0.285, y, 0.705,
          0.285, y, 0.705,
          0.285, y, 1.495,
          -0.285, y, 1.495,
        ],
        3,
      ),
    );
    geometry.setAttribute(
      "uv",
      new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    geometry.setIndex(
      nodeName === "Label_Front"
        ? [0, 1, 2, 0, 2, 3]
        : [0, 2, 1, 0, 3, 2],
    );
    return geometry;
  }

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  return geometry;
}

function createModelFixture(
  omittedNodes: readonly string[] = [],
) {
  const cachedScene = new Group();
  const sourceGeometries: BufferGeometry[] = [];
  const sourceMaterials: Material[] = [];

  REQUIRED_BOTTLE_NODES.forEach((nodeName) => {
    if (omittedNodes.includes(nodeName)) return;

    const geometry = createGeometry(nodeName);
    const material = new MeshStandardMaterial({ color: 0x675548 });
    geometry.name = `${nodeName}-cached-geometry`;
    material.name = `${nodeName}-cached-material`;
    const mesh = new Mesh(geometry, material);
    mesh.name = nodeName;
    cachedScene.add(mesh);
    sourceGeometries.push(geometry);
    sourceMaterials.push(material);
  });

  const runtimeScene = cachedScene.clone(true);
  const clone = vi.spyOn(cachedScene, "clone").mockReturnValue(runtimeScene);

  return {
    cachedScene,
    clone,
    runtimeScene,
    sourceGeometries,
    sourceMaterials,
  };
}

function createLabelTexture(name: string) {
  const image = document.createElement("canvas");
  image.width = 2400;
  image.height = 1200;
  const texture = new Texture(image);
  texture.name = name;
  return texture;
}

function createLabelFixture(): LabelFixture {
  return {
    back: createLabelTexture("approved-back-label"),
    front: createLabelTexture("approved-red-label"),
  };
}

function collectMeshes(scene: Object3D) {
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
}

function getSingleMaterial(mesh: Mesh) {
  if (Array.isArray(mesh.material)) {
    throw new Error(`Expected one material for ${mesh.name}`);
  }
  return mesh.material;
}

describe("BottleModel runtime ownership", () => {
  beforeEach(() => {
    dreiMock.useGLTF.mockReset();
    dreiMock.useTexture.mockReset();
    canvasContext.drawImage.mockClear();
    canvasContext.imageSmoothingEnabled = false;
    canvasContext.imageSmoothingQuality = "low";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((contextId: string) =>
        contextId === "2d" ? canvasContext : null) as unknown as HTMLCanvasElement["getContext"],
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the desktop GLB and red/back labels, fires once, and disposes only clones", () => {
    const model = createModelFixture();
    const labels = createLabelFixture();
    const cachedGeometryDisposals = model.sourceGeometries.map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    const cachedMaterialDisposals = model.sourceMaterials.map((material) =>
      vi.spyOn(material, "dispose"),
    );
    const cachedFrontTextureDisposal = vi.spyOn(labels.front, "dispose");
    const cachedBackTextureDisposal = vi.spyOn(labels.back, "dispose");
    dreiMock.useGLTF.mockReturnValue({ scene: model.cachedScene });
    dreiMock.useTexture.mockReturnValue([labels.front, labels.back]);
    const frameHandshakeRef = { current: false };
    const onRendered = vi.fn();
    const view = render(
      <BottleModel
        frameHandshakeRef={frameHandshakeRef}
        onRendered={onRendered}
        tier="high"
      />,
    );

    expect(dreiMock.useGLTF).toHaveBeenCalledWith(
      BOTTLE_MODEL_PATHS.high,
      false,
      false,
    );
    expect(dreiMock.useTexture).toHaveBeenCalledWith([
      BOTTLE_LABEL_PATHS.red,
      ACTIVE_LABEL_PATHS.back,
    ]);
    expect(dreiMock.useTexture).toHaveBeenCalledOnce();
    expect(dreiMock.useTexture.mock.calls.flat(2)).not.toContain(
      BOTTLE_LABEL_PATHS.white,
    );
    expect(dreiMock.useTexture.mock.calls.flat(2)).not.toContain(
      BOTTLE_LABEL_PATHS.sparkling,
    );
    expect(dreiMock.useTexture.mock.calls.flat(2)).not.toContain(
      BOTTLE_LABEL_PATHS.rose,
    );
    expect(model.clone).toHaveBeenCalledOnce();
    expect(model.clone).toHaveBeenCalledWith(true);
    expect(canvasContext.drawImage).toHaveBeenCalledTimes(2);
    model.sourceGeometries.forEach((geometry) => {
      expect(geometry.boundingBox).toBeNull();
      expect(geometry.boundingSphere).toBeNull();
    });

    const runtimeMeshes = collectMeshes(model.runtimeScene);
    expect(runtimeMeshes.map(({ name }) => name)).toEqual(
      expect.arrayContaining([...REQUIRED_BOTTLE_NODES]),
    );
    runtimeMeshes.forEach((mesh, index) => {
      expect(mesh.geometry).not.toBe(model.sourceGeometries[index]);
      expect(getSingleMaterial(mesh)).not.toBe(model.sourceMaterials[index]);
    });

    const frontLabel = model.runtimeScene.getObjectByName("Label_Front") as Mesh;
    const backLabel = model.runtimeScene.getObjectByName("Label_Back") as Mesh;
    const frontMaterial = getSingleMaterial(frontLabel) as MeshStandardMaterial;
    const backMaterial = getSingleMaterial(backLabel) as MeshStandardMaterial;
    const runtimeFrontTexture = frontMaterial.map;
    const runtimeBackTexture = backMaterial.map;
    const glass = model.runtimeScene.getObjectByName("Bottle_Glass") as Mesh;
    const liquid = model.runtimeScene.getObjectByName("Wine_Liquid") as Mesh;
    const capsule = model.runtimeScene.getObjectByName("Capsule") as Mesh;
    const cork = model.runtimeScene.getObjectByName("Cork") as Mesh;
    const glassMaterial = getSingleMaterial(glass) as MeshPhysicalMaterial;
    const liquidMaterial = getSingleMaterial(liquid) as MeshPhysicalMaterial;
    const capsuleMaterial = getSingleMaterial(capsule) as MeshPhysicalMaterial;
    const frontPositions = frontLabel.geometry.getAttribute("position");
    const frontNormals = frontLabel.geometry.getAttribute("normal");
    const frontUvs = frontLabel.geometry.getAttribute("uv");
    const backNormals = backLabel.geometry.getAttribute("normal");

    expect(frontPositions.count).toBe(50);
    expect(frontLabel.geometry.index?.count).toBe(144);
    expect(backLabel.geometry.getAttribute("position").count).toBe(50);
    expect(backLabel.geometry.index?.count).toBe(144);
    expect(frontUvs.count).toBe(50);
    expect(Math.min(...Array.from(frontUvs.array))).toBe(0);
    expect(Math.max(...Array.from(frontUvs.array))).toBe(1);

    frontLabel.geometry.computeBoundingBox();
    expect(frontLabel.geometry.boundingBox?.min.z).toBeCloseTo(0.565, 3);
    expect(frontLabel.geometry.boundingBox?.max.z).toBeCloseTo(1.355, 3);

    for (let index = 0; index < frontPositions.count; index += 1) {
      expect(
        Math.hypot(frontPositions.getX(index), frontPositions.getY(index)),
      ).toBeCloseTo(0.373, 3);
    }
    expect(
      Array.from({ length: frontNormals.count }, (_, index) =>
        frontNormals.getY(index),
      ).reduce((total, value) => total + value, 0),
    ).toBeLessThan(0);
    expect(
      Array.from({ length: backNormals.count }, (_, index) =>
        backNormals.getY(index),
      ).reduce((total, value) => total + value, 0),
    ).toBeGreaterThan(0);

    liquid.geometry.computeBoundingBox();
    const liquidPositions = liquid.geometry.getAttribute("position");
    const liquidNormals = liquid.geometry.getAttribute("normal");
    const maxLiquidRadius = Array.from(
      { length: liquidPositions.count },
      (_, index) =>
        Math.hypot(liquidPositions.getX(index), liquidPositions.getY(index)),
    ).reduce((maximum, radius) => Math.max(maximum, radius), 0);
    expect(liquid.geometry.boundingBox?.min.z).toBeCloseTo(0.06, 3);
    expect(liquid.geometry.boundingBox?.max.z).toBeCloseTo(1.86, 3);
    expect(maxLiquidRadius).toBeCloseTo(0.318, 3);
    expect(liquidMaterial.side).toBe(FrontSide);
    for (let point = 1; point < 8; point += 1) {
      const firstMeridian = point;
      const lastMeridian = 48 * 9 + point;
      expect(liquidNormals.getX(firstMeridian)).toBeCloseTo(
        liquidNormals.getX(lastMeridian),
        5,
      );
      expect(liquidNormals.getY(firstMeridian)).toBeCloseTo(
        liquidNormals.getY(lastMeridian),
        5,
      );
      expect(liquidNormals.getZ(firstMeridian)).toBeCloseTo(
        liquidNormals.getZ(lastMeridian),
        5,
      );
    }
    expect(glassMaterial).toBeInstanceOf(MeshPhysicalMaterial);
    expect(glassMaterial.opacity).toBe(0.55);
    expect(glassMaterial.roughness).toBe(0.18);
    expect(glassMaterial.side).toBe(FrontSide);
    expect(capsuleMaterial).toBeInstanceOf(MeshPhysicalMaterial);
    expect(capsuleMaterial.metalness).toBe(0.12);
    expect(capsuleMaterial.roughness).toBe(0.46);
    expect(cork.visible).toBe(false);
    const foilRings = collectMeshes(model.runtimeScene).filter(({ name }) =>
      name.startsWith("Capsule_Foil_Ring_"),
    );
    expect(foilRings).toHaveLength(2);
    expect(foilRings.map(({ position }) => position.z)).toEqual([2.555, 2.605]);
    foilRings.forEach(({ geometry }) => {
      expect(geometry).toBeInstanceOf(TorusGeometry);
      expect((geometry as TorusGeometry).parameters).toMatchObject({
        radialSegments: 6,
        radius: 0.165,
        tube: 0.006,
        tubularSegments: 48,
      });
    });

    expect(runtimeFrontTexture).toBeInstanceOf(Texture);
    expect(runtimeBackTexture).toBeInstanceOf(Texture);
    expect(runtimeFrontTexture).not.toBe(labels.front);
    expect(runtimeBackTexture).not.toBe(labels.back);
    expect(runtimeFrontTexture?.anisotropy).toBe(8);
    expect(runtimeBackTexture?.anisotropy).toBe(8);
    expect(runtimeFrontTexture?.flipY).toBe(true);
    expect(runtimeBackTexture?.flipY).toBe(true);

    const afterRender = frontLabel.onAfterRender as unknown as () => void;
    afterRender();
    afterRender();
    expect(frameHandshakeRef.current).toBe(true);
    expect(onRendered).toHaveBeenCalledOnce();

    const runtimeGeometryDisposals = runtimeMeshes.map((mesh) =>
      vi.spyOn(mesh.geometry, "dispose"),
    );
    const runtimeMaterialDisposals = [
      ...new Set(runtimeMeshes.map((mesh) => getSingleMaterial(mesh))),
    ].map((material) => vi.spyOn(material, "dispose"));
    const runtimeFrontTextureDisposal = vi.spyOn(
      runtimeFrontTexture!,
      "dispose",
    );
    const runtimeBackTextureDisposal = vi.spyOn(
      runtimeBackTexture!,
      "dispose",
    );

    view.unmount();

    runtimeGeometryDisposals.forEach((dispose) => {
      expect(dispose).toHaveBeenCalledOnce();
    });
    runtimeMaterialDisposals.forEach((dispose) => {
      expect(dispose).toHaveBeenCalledOnce();
    });
    expect(runtimeFrontTextureDisposal).toHaveBeenCalledOnce();
    expect(runtimeBackTextureDisposal).toHaveBeenCalledOnce();
    cachedGeometryDisposals.forEach((dispose) => {
      expect(dispose).not.toHaveBeenCalled();
    });
    cachedMaterialDisposals.forEach((dispose) => {
      expect(dispose).not.toHaveBeenCalled();
    });
    expect(cachedFrontTextureDisposal).not.toHaveBeenCalled();
    expect(cachedBackTextureDisposal).not.toHaveBeenCalled();

    frontLabel.onAfterRender({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    expect(onRendered).toHaveBeenCalledOnce();
  });

  it("loads the mobile GLB with standard-tier materials and no condensation", () => {
    const model = createModelFixture();
    const labels = createLabelFixture();
    dreiMock.useGLTF.mockReturnValue({ scene: model.cachedScene });
    dreiMock.useTexture.mockReturnValue([labels.front, labels.back]);
    const view = render(
      <BottleModel
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    expect(dreiMock.useGLTF).toHaveBeenCalledWith(
      BOTTLE_MODEL_PATHS.standard,
      false,
      false,
    );
    expect(dreiMock.useTexture).toHaveBeenCalledWith([
      ACTIVE_LABEL_PATHS.front,
      ACTIVE_LABEL_PATHS.back,
    ]);
    const frontLabel = model.runtimeScene.getObjectByName("Label_Front") as Mesh;
    const frontTexture = (getSingleMaterial(frontLabel) as MeshStandardMaterial)
      .map;
    const condensation = model.runtimeScene.getObjectByName(
      "Condensation",
    ) as Mesh;
    const standardFoilRing = model.runtimeScene.getObjectByName(
      "Capsule_Foil_Ring_1",
    ) as Mesh<TorusGeometry>;

    expect(frontTexture?.anisotropy).toBe(2);
    expect(frontLabel.geometry.getAttribute("position").count).toBe(26);
    expect(frontLabel.geometry.index?.count).toBe(72);
    expect(standardFoilRing.geometry.parameters.tubularSegments).toBe(24);
    expect(condensation.visible).toBe(false);
    view.unmount();
  });

  it("throws a deterministic contract error before cloning an incomplete model", () => {
    const model = createModelFixture(["Condensation"]);
    const labels = createLabelFixture();
    dreiMock.useGLTF.mockReturnValue({ scene: model.cachedScene });
    dreiMock.useTexture.mockReturnValue([labels.front, labels.back]);

    expect(() =>
      render(
        <BottleModel
          frameHandshakeRef={{ current: false }}
          onRendered={vi.fn()}
          tier="high"
        />,
      ),
    ).toThrow("Bottle model is missing required nodes: Condensation");
    expect(model.clone).not.toHaveBeenCalled();
  });

  it("lets a model-loader failure reach the WebGL error boundary", () => {
    dreiMock.useGLTF.mockImplementation(() => {
      throw new Error("desktop GLB failed to load");
    });

    expect(() =>
      render(
        <BottleModel
          frameHandshakeRef={{ current: false }}
          onRendered={vi.fn()}
          tier="high"
        />,
      ),
    ).toThrow("desktop GLB failed to load");
    expect(dreiMock.useGLTF).toHaveBeenCalledWith(
      BOTTLE_MODEL_PATHS.high,
      false,
      false,
    );
    expect(dreiMock.useTexture).not.toHaveBeenCalled();
  });
});
