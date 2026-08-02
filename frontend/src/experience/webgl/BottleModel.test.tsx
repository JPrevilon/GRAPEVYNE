import { cleanup, render } from "@testing-library/react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Texture,
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

function createGeometry() {
  const geometry = new BufferGeometry();
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

    const geometry = createGeometry();
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

    expect(dreiMock.useGLTF).toHaveBeenCalledWith(BOTTLE_MODEL_PATHS.high);
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
    const runtimeMaterialDisposals = runtimeMeshes.map((mesh) =>
      vi.spyOn(getSingleMaterial(mesh), "dispose"),
    );
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

    expect(dreiMock.useGLTF).toHaveBeenCalledWith(BOTTLE_MODEL_PATHS.standard);
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

    expect(frontTexture?.anisotropy).toBe(2);
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
    expect(dreiMock.useGLTF).toHaveBeenCalledWith(BOTTLE_MODEL_PATHS.high);
    expect(dreiMock.useTexture).not.toHaveBeenCalled();
  });
});
