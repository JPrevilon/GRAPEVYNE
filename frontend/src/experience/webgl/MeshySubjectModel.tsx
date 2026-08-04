import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Box3,
  DoubleSide,
  FrontSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Object3D,
} from "three";

import {
  BOTTLE_LABEL_PATHS,
  MESHY_BOTTLE_MODEL_PATHS,
  MESHY_GRAPE_MODEL_PATHS,
  type BottleLabelFamily,
} from "./modelAssets";
import {
  MESHY_LABEL_FIT,
  createCurvedLabelGeometry,
} from "./meshyLabelGeometry";
import type { WebGLQualityTier } from "./qualityTier";

export type MeshySubjectKind = "bottle" | "grapes";

interface MeshySubjectModelProps {
  frameHandshakeRef: MutableRefObject<boolean>;
  kind: MeshySubjectKind;
  labelVariant?: BottleLabelFamily;
  onRendered: () => void;
  opacityRef: MutableRefObject<number>;
  tier: WebGLQualityTier;
}

interface RuntimeModel {
  materials: Array<{ baseOpacity: number; material: Material }>;
  normalizedPosition: readonly [number, number, number];
  normalizedScale: number;
  scene: Object3D;
}

const MODEL_HEIGHT = 2;
// The optimized Meshy bottle normalizes to a body radius of about 0.253.
// Keep the neutral paper mask and exact artwork close to that surface so the
// label reads as wrapped paper instead of a floating card at quarter angles.
function cloneRuntimeModel(
  cachedScene: Object3D,
  kind: MeshySubjectKind,
): RuntimeModel {
  const scene = cachedScene.clone(true);
  const materials: RuntimeModel["materials"] = [];

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const clonedMaterials = sourceMaterials.map((sourceMaterial) => {
      const material = sourceMaterial.clone();
      const baseOpacity = material.opacity;
      if (kind === "grapes") material.side = DoubleSide;
      material.transparent = true;
      material.opacity = 0;
      material.needsUpdate = true;
      materials.push({ baseOpacity, material });
      return material;
    });
    object.material = Array.isArray(object.material)
      ? clonedMaterials
      : clonedMaterials[0];
    if (kind === "grapes") object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());

  if (!Number.isFinite(size.y) || size.y <= 0) {
    throw new Error("Meshy subject has invalid bounds.");
  }

  const normalizedScale = MODEL_HEIGHT / size.y;
  return {
    materials,
    normalizedPosition: [
      -center.x * normalizedScale,
      -center.y * normalizedScale,
      -center.z * normalizedScale,
    ],
    normalizedScale,
    scene,
  };
}

function CurvedBottleLabel({
  labelVariant,
  opacityRef,
}: {
  labelVariant: BottleLabelFamily;
  opacityRef: MutableRefObject<number>;
}) {
  const source = useTexture(BOTTLE_LABEL_PATHS[labelVariant]) as Texture;
  const geometry = useMemo(() => createCurvedLabelGeometry(32), []);
  const maskMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xeee5d3,
        metalness: 0,
        opacity: 0,
        roughness: 0.94,
        side: FrontSide,
        transparent: true,
      }),
    [],
  );
  const material = useMemo(() => {
    source.colorSpace = SRGBColorSpace;
    source.anisotropy = 8;
    source.needsUpdate = true;
    return new MeshStandardMaterial({
      alphaTest: 0.025,
      color: 0xffffff,
      map: source,
      metalness: 0,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      roughness: 0.92,
      side: FrontSide,
      transparent: true,
    });
  }, [source]);

  useFrame(() => {
    const opacity = Math.max(0, Math.min(1, opacityRef.current));
    maskMaterial.opacity = opacity;
    maskMaterial.visible = opacity > 0.001;
    material.opacity = opacity;
    material.visible = opacity > 0.001;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      maskMaterial.dispose();
      material.dispose();
    },
    [geometry, maskMaterial, material],
  );

  return (
    <group>
      <mesh material={maskMaterial} position-y={MESHY_LABEL_FIT.y} renderOrder={7}>
        <cylinderGeometry
          args={[
            MESHY_LABEL_FIT.maskRadius,
            MESHY_LABEL_FIT.maskRadius,
            MESHY_LABEL_FIT.height,
            64,
            1,
            true,
          ]}
        />
      </mesh>
      <mesh geometry={geometry} material={material} renderOrder={8} />
    </group>
  );
}

export default function MeshySubjectModel({
  frameHandshakeRef,
  kind,
  labelVariant = "red",
  onRendered,
  opacityRef,
  tier,
}: MeshySubjectModelProps) {
  const path =
    kind === "bottle"
      ? MESHY_BOTTLE_MODEL_PATHS[tier]
      : MESHY_GRAPE_MODEL_PATHS[tier];
  const { scene: cachedScene } = useGLTF(path, false, false);
  const groupRef = useRef<Group>(null);
  const runtime = useMemo(
    () => cloneRuntimeModel(cachedScene, kind),
    [cachedScene, kind],
  );

  useEffect(() => {
    let handshakeMesh: Mesh | undefined;
    runtime.scene.traverse((object) => {
      if (!handshakeMesh && object instanceof Mesh) handshakeMesh = object;
    });

    if (handshakeMesh) {
      handshakeMesh.onAfterRender = () => {
        if (frameHandshakeRef.current) return;
        frameHandshakeRef.current = true;
        onRendered();
      };
    }

    return () => {
      if (handshakeMesh) handshakeMesh.onAfterRender = () => undefined;
    };
  }, [frameHandshakeRef, onRendered, runtime.scene]);

  useFrame(() => {
    const opacity = Math.max(0, Math.min(1, opacityRef.current));
    if (groupRef.current) groupRef.current.visible = opacity > 0.001;
    runtime.materials.forEach(({ baseOpacity, material }) => {
      material.opacity = baseOpacity * opacity;
      material.visible = opacity > 0.001;
    });
  });

  useEffect(
    () => () => {
      runtime.materials.forEach(({ material }) => material.dispose());
    },
    [runtime.materials],
  );

  return (
    <group ref={groupRef} visible={false}>
      <primitive
        dispose={null}
        object={runtime.scene}
        position={runtime.normalizedPosition}
        scale={runtime.normalizedScale}
      />
      {kind === "bottle" ? (
        <CurvedBottleLabel
          labelVariant={labelVariant}
          opacityRef={opacityRef}
        />
      ) : null}
    </group>
  );
}
