import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useRef } from "react";
import { Group, MathUtils, PointLight, SpotLight, type Mesh } from "three";

import { useScene } from "@/experience/useScene";
import {
  SUBJECT_HIDDEN_AT,
  deriveStorySubjectFrame,
  getNextStoryChapter,
} from "@/experience/storySubject";

import MeshySubjectModel from "./MeshySubjectModel";
import { getClampedPointerRotation } from "./pointerMotion";
import type { WebGLQualityTier } from "./qualityTier";

interface SceneRigProps {
  frameHandshakeRef: MutableRefObject<boolean>;
  onRendered: () => void;
  tier: WebGLQualityTier;
}

interface SubjectTarget {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

const DESKTOP_TARGETS = {
  atlas: {
    position: [1.45, -0.64, -0.12],
    rotation: [0.015, -0.2, -0.015],
    scale: 0.74,
  },
  discovery: {
    position: [1.48, -0.02, -0.15],
    rotation: [-0.08, -0.3, 0.08],
    scale: 1.04,
  },
  hero: {
    position: [1.62, -0.38, -0.02],
    rotation: [0, 0.06, -0.012],
    scale: 1.16,
  },
  portal: {
    position: [-1.34, -0.42, -0.14],
    rotation: [0.01, 0.22, 0],
    scale: 0.98,
  },
} satisfies Record<"atlas" | "discovery" | "hero" | "portal", SubjectTarget>;

const MOBILE_TARGETS = {
  atlas: {
    position: [0.86, -0.86, -0.24],
    rotation: [0, -0.18, 0],
    scale: 0.58,
  },
  discovery: {
    position: [0.72, -0.58, -0.28],
    rotation: [-0.08, -0.2, 0.08],
    scale: 0.62,
  },
  hero: {
    position: [0.9, -0.28, -0.26],
    rotation: [0, 0.04, 0],
    scale: 0.58,
  },
  portal: {
    position: [-0.7, -0.78, -0.25],
    rotation: [0, 0.2, 0],
    scale: 0.62,
  },
} satisfies Record<"atlas" | "discovery" | "hero" | "portal", SubjectTarget>;

const FALLBACK_TARGET: SubjectTarget = {
  position: [0, -0.4, 0],
  rotation: [0, 0, 0],
  scale: 0.8,
};

function getTarget(
  chapter: string,
  tier: WebGLQualityTier,
): SubjectTarget {
  const targets = tier === "high" ? DESKTOP_TARGETS : MOBILE_TARGETS;
  return chapter in targets
    ? targets[chapter as keyof typeof targets]
    : FALLBACK_TARGET;
}

function applyTargetPosition(group: Group | null, target: SubjectTarget) {
  if (!group) return;
  group.position.set(...target.position);
  group.scale.setScalar(target.scale);
  group.rotation.z = target.rotation[2];
}

export default function SceneRig({
  frameHandshakeRef,
  onRendered,
  tier,
}: SceneRigProps) {
  const { chapter, progressRef } = useScene();
  const bottleGroup = useRef<Group>(null);
  const grapeGroup = useRef<Group>(null);
  const bottleOpacity = useRef(0);
  const grapeOpacity = useRef(0);
  const keyLight = useRef<SpotLight>(null);
  const fillLight = useRef<PointLight>(null);
  const shadow = useRef<Mesh>(null);
  const pointerYaw = useRef(0);
  const pointerPitch = useRef(0);

  useEffect(() => {
    if (tier !== "high") return undefined;
    const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;
    if (!finePointer) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || document.hidden) return;
      const pointer = getClampedPointerRotation(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      );
      pointerYaw.current = pointer.yaw;
      pointerPitch.current = pointer.pitch;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      pointerYaw.current = 0;
      pointerPitch.current = 0;
    };
  }, [tier]);

  useFrame((_state, rawDelta) => {
    const progress = MathUtils.clamp(progressRef.current.chapter, 0, 1);
    const frame = deriveStorySubjectFrame(chapter, progress);
    const nextChapter = getNextStoryChapter(chapter);
    const targetChapter = progress >= SUBJECT_HIDDEN_AT ? nextChapter : chapter;
    const target = getTarget(targetChapter, tier);
    const delta = Math.min(rawDelta, 1 / 20);

    bottleOpacity.current =
      (frame.current === "bottle" ? frame.currentOpacity : 0) +
      (frame.next === "bottle" ? frame.nextOpacity : 0);
    grapeOpacity.current =
      (frame.current === "grapes" ? frame.currentOpacity : 0) +
      (frame.next === "grapes" ? frame.nextOpacity : 0);

    // Group visibility is owned by this parent frame so a final demand-render
    // can hide a subject synchronously even when child material callbacks were
    // subscribed first. This prevents a completed frame from remaining frozen
    // when the renderer sleeps for a subject-free chapter.
    if (bottleGroup.current) {
      bottleGroup.current.visible = bottleOpacity.current > 0.001;
    }
    if (grapeGroup.current) {
      grapeGroup.current.visible = grapeOpacity.current > 0.001;
    }

    // The target selection flips exactly at the fully hidden boundary. Applying
    // position and scale on every projected frame keeps reverse scrolling just
    // as deterministic as forward scrolling without ever animating a visible
    // subject across the stage.
    applyTargetPosition(bottleGroup.current, target);
    applyTargetPosition(grapeGroup.current, target);

    if (bottleGroup.current) {
      bottleGroup.current.rotation.x = MathUtils.damp(
        bottleGroup.current.rotation.x,
        target.rotation[0] + pointerPitch.current,
        6,
        delta,
      );
      bottleGroup.current.rotation.y = MathUtils.damp(
        bottleGroup.current.rotation.y,
        target.rotation[1] + pointerYaw.current,
        6,
        delta,
      );
    }

    if (grapeGroup.current) {
      const scrollRotation = frame.current === "grapes" ? progress * 0.14 : 0;
      grapeGroup.current.rotation.y =
        target.rotation[1] + scrollRotation;
      grapeGroup.current.rotation.x = target.rotation[0] - progress * 0.035;
    }

    const visibleOpacity = Math.max(
      bottleOpacity.current,
      grapeOpacity.current,
    );
    if (keyLight.current) {
      keyLight.current.intensity = MathUtils.damp(
        keyLight.current.intensity,
        (tier === "high" ? 3.4 : 2.6) * visibleOpacity,
        5,
        delta,
      );
    }
    if (fillLight.current) {
      fillLight.current.intensity = MathUtils.damp(
        fillLight.current.intensity,
        (tier === "high" ? 1.1 : 0.72) * visibleOpacity,
        5,
        delta,
      );
    }
    if (shadow.current) {
      shadow.current.visible = bottleOpacity.current > 0.01;
      const scale = 0.7 + bottleOpacity.current * 0.3;
      shadow.current.scale.setScalar(scale);
      const material = Array.isArray(shadow.current.material)
        ? shadow.current.material[0]
        : shadow.current.material;
      if (material) material.opacity = 0.22 * bottleOpacity.current;
    }
  });

  const initialTarget = getTarget("hero", tier);

  return (
    <>
      <hemisphereLight
        args={[0xefe5d1, 0x07131c, tier === "high" ? 0.72 : 0.56]}
      />
      <spotLight
        angle={0.42}
        color={0xf0d2a0}
        decay={2}
        distance={12}
        intensity={3.4}
        penumbra={0.96}
        position={[3.1, 4.4, 4.8]}
        ref={keyLight}
      />
      <pointLight
        color={0xffe7c2}
        decay={2}
        distance={7}
        intensity={1.1}
        position={[0.4, 0.5, 4.2]}
        ref={fillLight}
      />
      <directionalLight color={0xb7cfe0} intensity={0.42} position={[-3, 2, 3]} />

      <group
        position={initialTarget.position}
        ref={bottleGroup}
        rotation={initialTarget.rotation}
        scale={initialTarget.scale}
      >
        {tier === "high" ? (
          <mesh position={[0, -1.02, 0]} ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.44, 48]} />
            <meshBasicMaterial
              color={0x000000}
              depthWrite={false}
              opacity={0.22}
              transparent
            />
          </mesh>
        ) : null}
        <MeshySubjectModel
          frameHandshakeRef={frameHandshakeRef}
          kind="bottle"
          onRendered={onRendered}
          opacityRef={bottleOpacity}
          tier={tier}
        />
      </group>

      <group
        position={getTarget("discovery", tier).position}
        ref={grapeGroup}
        rotation={getTarget("discovery", tier).rotation}
        scale={getTarget("discovery", tier).scale}
      >
        <MeshySubjectModel
          frameHandshakeRef={frameHandshakeRef}
          kind="grapes"
          onRendered={onRendered}
          opacityRef={grapeOpacity}
          tier={tier}
        />
      </group>
    </>
  );
}
