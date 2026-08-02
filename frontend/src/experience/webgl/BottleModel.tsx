import { useGLTF, useTexture } from "@react-three/drei";
import { type MutableRefObject, useEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  FrontSide,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  type BufferGeometry,
  type Object3D,
} from "three";

import { ACTIVE_LABEL_PATHS, BOTTLE_MODEL_PATHS } from "./modelAssets";
import { assertBottleModelContract } from "./modelContract";
import type { WebGLQualityTier } from "./qualityTier";

interface BottleModelProps {
  frameHandshakeRef: MutableRefObject<boolean>;
  onRendered: () => void;
  tier: WebGLQualityTier;
}

interface RuntimeBottle {
  geometries: BufferGeometry[];
  materials: Material[];
  scene: Object3D;
  textures: Texture[];
}

const LABEL_MAX_EDGE: Record<WebGLQualityTier, number> = {
  high: 2048,
  standard: 1024,
};

function getTextureDimensions(texture: Texture) {
  const image = texture.image as
    | {
        height?: number;
        naturalHeight?: number;
        naturalWidth?: number;
        width?: number;
      }
    | undefined;

  return {
    height: image?.naturalHeight ?? image?.height ?? 0,
    image,
    width: image?.naturalWidth ?? image?.width ?? 0,
  };
}

function createRuntimeLabelTexture(
  source: Texture,
  maxEdge: number,
  anisotropy: number,
) {
  const { height, image, width } = getTextureDimensions(source);

  if (!image || width <= 0 || height <= 0) {
    throw new Error("Approved bottle label texture did not decode.");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Bottle label texture could not be prepared.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = anisotropy;
  texture.colorSpace = SRGBColorSpace;
  // The approved placeholder exports label UV v=0 along the physical bottom
  // edge, so external browser images need the normal TextureLoader Y flip.
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.name = `${source.name || "label"}-runtime-${maxEdge}`;
  texture.needsUpdate = true;
  return texture;
}

function cloneGeometry(source: BufferGeometry) {
  const geometry = source.clone();

  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }

  return geometry;
}

function getSourceColor(material: Material, fallback: number) {
  return material instanceof MeshStandardMaterial
    ? material.color
    : new Color(fallback);
}

function makeBottleMaterial(
  nodeName: string,
  source: Material,
  frontTexture: Texture,
  backTexture: Texture,
  tier: WebGLQualityTier,
) {
  let material: Material;

  switch (nodeName) {
    case "Bottle_Glass": {
      material = new MeshPhysicalMaterial({
        clearcoat: 0.72,
        clearcoatRoughness: 0.12,
        color: getSourceColor(source, 0x23402f),
        depthWrite: false,
        ior: 1.46,
        metalness: 0.02,
        opacity: tier === "high" ? 0.42 : 0.48,
        roughness: 0.09,
        side: DoubleSide,
        specularIntensity: 0.9,
        thickness: 0.16,
        transparent: true,
      });
      break;
    }
    case "Wine_Liquid": {
      material = new MeshPhysicalMaterial({
        clearcoat: 0.28,
        clearcoatRoughness: 0.2,
        color: 0x4c0c20,
        metalness: 0,
        opacity: 0.94,
        roughness: 0.24,
        transparent: true,
      });
      break;
    }
    case "Label_Front":
    case "Label_Back": {
      material = new MeshStandardMaterial({
        alphaTest: 0.025,
        color: 0xffffff,
        map: nodeName === "Label_Front" ? frontTexture : backTexture,
        metalness: 0,
        roughness: 0.82,
        side: FrontSide,
        transparent: true,
      });
      break;
    }
    case "Condensation": {
      material = new MeshPhysicalMaterial({
        clearcoat: 1,
        color: 0xf5eee2,
        depthWrite: false,
        metalness: 0,
        opacity: tier === "high" ? 0.22 : 0,
        roughness: 0.08,
        transparent: true,
      });
      break;
    }
    default: {
      material = source.clone();

      if (material instanceof MeshStandardMaterial) {
        material.metalness = nodeName === "Capsule" ? 0.42 : 0;
        material.roughness = nodeName === "Cork" ? 0.88 : 0.38;
      }
    }
  }

  material.name = `${source.name || nodeName}-runtime`;
  material.needsUpdate = true;
  return material;
}

function setMeshRenderContract(mesh: Mesh, tier: WebGLQualityTier) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  switch (mesh.name) {
    case "Wine_Liquid":
      mesh.renderOrder = 1;
      break;
    case "Bottle_Glass":
      mesh.renderOrder = 2;
      break;
    case "Condensation":
      mesh.renderOrder = 3;
      mesh.visible = tier === "high";
      break;
    case "Label_Front":
    case "Label_Back":
      mesh.renderOrder = 4;
      break;
    default:
      mesh.renderOrder = 2;
  }
}

export default function BottleModel({
  frameHandshakeRef,
  onRendered,
  tier,
}: BottleModelProps) {
  const { scene: cachedScene } = useGLTF(BOTTLE_MODEL_PATHS[tier]);
  const labelSources = useTexture([
    ACTIVE_LABEL_PATHS.front,
    ACTIVE_LABEL_PATHS.back,
  ]) as Texture[];
  const frontLabelSource = labelSources[0];
  const backLabelSource = labelSources[1];

  if (!frontLabelSource || !backLabelSource) {
    throw new Error("Approved bottle label textures were not loaded.");
  }

  const runtime = useMemo<RuntimeBottle>(() => {
    assertBottleModelContract(cachedScene);

    const anisotropy = tier === "high" ? 8 : 2;
    const maxEdge = LABEL_MAX_EDGE[tier];
    const frontTexture = createRuntimeLabelTexture(
      frontLabelSource,
      maxEdge,
      anisotropy,
    );
    const backTexture = createRuntimeLabelTexture(
      backLabelSource,
      maxEdge,
      anisotropy,
    );
    const clonedScene = cachedScene.clone(true);
    const geometries: BufferGeometry[] = [];
    const materials: Material[] = [];

    clonedScene.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      const mesh = object;
      const geometry = cloneGeometry(mesh.geometry);
      const sourceMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const runtimeMaterials = sourceMaterials.map((sourceMaterial) =>
        makeBottleMaterial(
          mesh.name,
          sourceMaterial,
          frontTexture,
          backTexture,
          tier,
        ),
      );

      geometries.push(geometry);
      materials.push(...runtimeMaterials);
      mesh.geometry = geometry;
      mesh.material = Array.isArray(mesh.material)
        ? runtimeMaterials
        : runtimeMaterials[0];
      setMeshRenderContract(mesh, tier);

      if (mesh.name === "Label_Front") {
        mesh.onAfterRender = () => {
          if (frameHandshakeRef.current) return;
          frameHandshakeRef.current = true;
          onRendered();
        };
      }
    });

    return {
      geometries,
      materials,
      scene: clonedScene,
      textures: [frontTexture, backTexture],
    };
  }, [backLabelSource, cachedScene, frameHandshakeRef, frontLabelSource, onRendered, tier]);

  useEffect(
    () => () => {
      runtime.scene.traverse((object) => {
        if (object instanceof Mesh) object.onAfterRender = () => undefined;
      });
      runtime.materials.forEach((material) => material.dispose());
      runtime.geometries.forEach((geometry) => geometry.dispose());
      runtime.textures.forEach((texture) => texture.dispose());
    },
    [runtime],
  );

  return <primitive dispose={null} object={runtime.scene} />;
}
