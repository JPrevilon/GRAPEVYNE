import { useGLTF, useTexture } from "@react-three/drei";
import { type MutableRefObject, useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  FrontSide,
  LatheGeometry,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector2,
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

const LABEL_CURVE_SEGMENTS: Record<WebGLQualityTier, number> = {
  high: 24,
  standard: 12,
};

const LABEL_SURFACE_LIFT = 0.001;
const LABEL_VERTICAL_OFFSET = -0.14;

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

function createCurvedLabelGeometry(
  source: BufferGeometry,
  nodeName: "Label_Back" | "Label_Front",
  tier: WebGLQualityTier,
) {
  const sourcePositions = source.getAttribute("position");

  if (!sourcePositions) return cloneGeometry(source);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < sourcePositions.count; index += 1) {
    const x = sourcePositions.getX(index);
    const y = sourcePositions.getY(index);
    const z = sourcePositions.getZ(index);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const halfWidth = (maxX - minX) / 2;
  const height = maxZ - minZ;
  const sourceRadius = Math.max(Math.abs(minY), Math.abs(maxY));

  if (halfWidth <= 0 || height <= 0 || sourceRadius <= halfWidth) {
    return cloneGeometry(source);
  }

  const centerX = (minX + maxX) / 2;
  const radius = sourceRadius + LABEL_SURFACE_LIFT;
  const halfAngle = Math.asin(Math.min(0.99, halfWidth / radius));
  const segments = LABEL_CURVE_SEGMENTS[tier];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const side = nodeName === "Label_Front" ? -1 : 1;

  for (let row = 0; row < 2; row += 1) {
    const z =
      (row === 0 ? minZ : maxZ) + LABEL_VERTICAL_OFFSET;

    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments;
      const theta = -halfAngle + u * halfAngle * 2;
      positions.push(
        centerX + radius * Math.sin(theta),
        side * radius * Math.cos(theta),
        z,
      );
      uvs.push(u, row);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const bottomLeft = segment;
    const bottomRight = segment + 1;
    const topLeft = segments + 1 + segment;
    const topRight = topLeft + 1;

    if (nodeName === "Label_Front") {
      indices.push(
        bottomLeft,
        bottomRight,
        topRight,
        bottomLeft,
        topRight,
        topLeft,
      );
    } else {
      indices.push(
        bottomLeft,
        topRight,
        bottomRight,
        bottomLeft,
        topLeft,
        topRight,
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.name = `${source.name || nodeName}-runtime-curved`;
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createLiquidGeometry(tier: WebGLQualityTier) {
  const profile = [
    new Vector2(0, 0.06),
    new Vector2(0.305, 0.06),
    new Vector2(0.318, 0.1),
    new Vector2(0.318, 1.42),
    new Vector2(0.305, 1.54),
    new Vector2(0.275, 1.66),
    new Vector2(0.235, 1.76),
    new Vector2(0.19, 1.86),
    new Vector2(0, 1.86),
  ];
  const geometry = new LatheGeometry(profile, tier === "high" ? 48 : 24);
  geometry.name = `Wine_Liquid-runtime-${tier}`;
  geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRuntimeGeometry(
  source: BufferGeometry,
  nodeName: string,
  tier: WebGLQualityTier,
) {
  if (nodeName === "Label_Front" || nodeName === "Label_Back") {
    return createCurvedLabelGeometry(source, nodeName, tier);
  }

  if (nodeName === "Wine_Liquid") {
    return createLiquidGeometry(tier);
  }

  return cloneGeometry(source);
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
        clearcoat: 0.85,
        clearcoatRoughness: 0.16,
        color: 0x2a1117,
        depthWrite: false,
        ior: 1.5,
        metalness: 0,
        opacity: tier === "high" ? 0.55 : 0.64,
        roughness: 0.18,
        side: FrontSide,
        specularColor: 0xf1dcc0,
        specularIntensity: 0.7,
        transparent: true,
      });
      break;
    }
    case "Wine_Liquid": {
      material = new MeshPhysicalMaterial({
        clearcoat: 0.12,
        clearcoatRoughness: 0.3,
        color: 0x4a0615,
        metalness: 0,
        opacity: 0.96,
        roughness: 0.3,
        side: FrontSide,
        transparent: true,
      });
      break;
    }
    case "Capsule": {
      material = new MeshPhysicalMaterial({
        clearcoat: 0.25,
        clearcoatRoughness: 0.34,
        color: 0x741727,
        metalness: 0.12,
        roughness: 0.46,
      });
      break;
    }
    case "Label_Front":
    case "Label_Back": {
      material = new MeshStandardMaterial({
        alphaTest: 0.025,
        color: 0xffffff,
        emissive: 0x4a3e2c,
        emissiveIntensity: 0.32,
        map: nodeName === "Label_Front" ? frontTexture : backTexture,
        metalness: 0,
        roughness: 0.9,
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
        opacity: tier === "high" ? 0.07 : 0,
        roughness: 0.2,
        transparent: true,
      });
      break;
    }
    default: {
      material = source.clone();

      if (material instanceof MeshStandardMaterial) {
        material.metalness = 0;
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
    case "Cork":
      mesh.renderOrder = 2;
      mesh.visible = false;
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
  const { scene: cachedScene } = useGLTF(
    BOTTLE_MODEL_PATHS[tier],
    false,
    false,
  );
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
      const geometry = createRuntimeGeometry(mesh.geometry, mesh.name, tier);
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

    const capsule = clonedScene.getObjectByName("Capsule");
    const modelRoot = clonedScene.getObjectByName("world") ?? clonedScene;

    if (capsule instanceof Mesh && !Array.isArray(capsule.material)) {
      const ringSegments = tier === "high" ? 48 : 24;

      [2.555, 2.605].forEach((z, index) => {
        const geometry = new TorusGeometry(0.165, 0.006, 6, ringSegments);
        geometry.name = `Capsule_Foil_Ring_${index + 1}-runtime`;
        const ring = new Mesh(geometry, capsule.material);
        ring.name = `Capsule_Foil_Ring_${index + 1}`;
        ring.position.z = z;
        ring.renderOrder = 2;
        modelRoot.add(ring);
        geometries.push(geometry);
      });
    }

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
