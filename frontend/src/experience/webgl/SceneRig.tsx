import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useRef } from "react";
import {
  Box3,
  type Camera,
  Group,
  Matrix4,
  MathUtils,
  PointLight,
  SpotLight,
  Vector3,
  type Mesh,
} from "three";

import { useScene } from "@/experience/useScene";
import {
  STORY_CHAPTERS,
  STORY_SUBJECTS,
  type StoryChapter,
} from "@/experience/storyChapters";

import MeshySubjectModel from "./MeshySubjectModel";
import type { WebGLQualityTier } from "./qualityTier";
import {
  createSubjectInteractionState,
  type SubjectInteractionState,
} from "./subjectInteraction";

interface SceneRigProps {
  frameHandshakeRef: MutableRefObject<boolean>;
  interactionRef?: MutableRefObject<SubjectInteractionState>;
  onRendered: () => void;
  tier: WebGLQualityTier;
}

interface SubjectTarget {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

interface ProjectionScratch {
  box: Box3;
  element: HTMLButtonElement | null;
  group: Group | null;
  height: number;
  inverseWorld: Matrix4;
  left: number;
  localCorners: Vector3[];
  projectedCorners: Vector3[];
  top: number;
  width: number;
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
  chapter: StoryChapter,
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

function createProjectionScratch(): ProjectionScratch {
  return {
    box: new Box3(),
    element: null,
    group: null,
    height: -1,
    inverseWorld: new Matrix4(),
    left: -1,
    localCorners: Array.from({ length: 8 }, () => new Vector3()),
    projectedCorners: Array.from({ length: 8 }, () => new Vector3()),
    top: -1,
    width: -1,
  };
}

function setBoxCorners(box: Box3, corners: Vector3[]) {
  const { max, min } = box;
  corners[0]?.set(min.x, min.y, min.z);
  corners[1]?.set(min.x, min.y, max.z);
  corners[2]?.set(min.x, max.y, min.z);
  corners[3]?.set(min.x, max.y, max.z);
  corners[4]?.set(max.x, min.y, min.z);
  corners[5]?.set(max.x, min.y, max.z);
  corners[6]?.set(max.x, max.y, min.z);
  corners[7]?.set(max.x, max.y, max.z);
}

function projectInteractionBounds(
  camera: Camera,
  element: HTMLButtonElement,
  group: Group,
  scratch: ProjectionScratch,
  viewportHeight: number,
  viewportWidth: number,
) {
  if (scratch.element !== element || scratch.group !== group) {
    group.updateWorldMatrix(true, true);
    scratch.box.setFromObject(group, true);
    if (scratch.box.isEmpty()) return;

    setBoxCorners(scratch.box, scratch.localCorners);
    scratch.inverseWorld.copy(group.matrixWorld).invert();
    for (const corner of scratch.localCorners) {
      corner.applyMatrix4(scratch.inverseWorld);
    }
    scratch.element = element;
    scratch.group = group;
    scratch.height = -1;
    scratch.left = -1;
    scratch.top = -1;
    scratch.width = -1;
  }

  group.updateWorldMatrix(true, false);

  let minimumX = 1;
  let maximumX = -1;
  let minimumY = 1;
  let maximumY = -1;
  for (let index = 0; index < scratch.localCorners.length; index += 1) {
    const corner = scratch.projectedCorners[index];
    const localCorner = scratch.localCorners[index];
    if (!corner || !localCorner) continue;
    corner.copy(localCorner).applyMatrix4(group.matrixWorld);
    corner.project(camera);
    minimumX = Math.min(minimumX, corner.x);
    maximumX = Math.max(maximumX, corner.x);
    minimumY = Math.min(minimumY, corner.y);
    maximumY = Math.max(maximumY, corner.y);
  }

  const rawLeft = ((minimumX + 1) / 2) * viewportWidth;
  const rawRight = ((maximumX + 1) / 2) * viewportWidth;
  const rawTop = ((1 - maximumY) / 2) * viewportHeight;
  const rawBottom = ((1 - minimumY) / 2) * viewportHeight;
  const horizontalPadding = MathUtils.clamp(
    (rawRight - rawLeft) * 0.28,
    18,
    52,
  );
  const verticalPadding = MathUtils.clamp(
    (rawBottom - rawTop) * 0.1,
    14,
    36,
  );
  const left = Math.max(0, rawLeft - horizontalPadding);
  const top = Math.max(0, rawTop - verticalPadding);
  const width = Math.max(
    44,
    Math.min(viewportWidth - left, rawRight - rawLeft + 2 * horizontalPadding),
  );
  const height = Math.max(
    44,
    Math.min(viewportHeight - top, rawBottom - rawTop + 2 * verticalPadding),
  );

  if (
    Math.abs(left - scratch.left) < 0.5 &&
    Math.abs(top - scratch.top) < 0.5 &&
    Math.abs(width - scratch.width) < 0.5 &&
    Math.abs(height - scratch.height) < 0.5
  ) {
    return;
  }

  scratch.left = left;
  scratch.top = top;
  scratch.width = width;
  scratch.height = height;
  element.style.left = `${left}px`;
  element.style.right = "auto";
  element.style.top = `${top}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.dataset.projectedHitArea = "true";
}

export default function SceneRig({
  frameHandshakeRef,
  interactionRef,
  onRendered,
  tier,
}: SceneRigProps) {
  const { progressRef } = useScene();
  const fallbackInteractionRef = useRef(createSubjectInteractionState());
  const resolvedInteractionRef = interactionRef ?? fallbackInteractionRef;
  const bottleGroup = useRef<Group>(null);
  const grapeGroup = useRef<Group>(null);
  const bottleOpacity = useRef(0);
  const grapeOpacity = useRef(0);
  const keyLight = useRef<SpotLight>(null);
  const fillLight = useRef<PointLight>(null);
  const shadow = useRef<Mesh>(null);
  const projectionScratch = useRef(createProjectionScratch());

  useFrame((state, rawDelta) => {
    const transition = progressRef.current.transition;
    const lowerChapter = STORY_CHAPTERS[transition.lowerIndex]?.key ?? "hero";
    const upperChapter = STORY_CHAPTERS[transition.upperIndex]?.key ?? lowerChapter;
    const lowerSubject = STORY_SUBJECTS[lowerChapter];
    const upperSubject = STORY_SUBJECTS[upperChapter];
    const targetChapter = STORY_CHAPTERS[transition.ownerIndex]?.key ?? lowerChapter;
    const target = getTarget(targetChapter, tier);
    const delta = Math.min(rawDelta, 1 / 20);

    bottleOpacity.current =
      (lowerSubject === "bottle" ? transition.lowerOpacity : 0) +
      (transition.upperIndex !== transition.lowerIndex &&
      upperSubject === "bottle"
        ? transition.upperOpacity
        : 0);
    grapeOpacity.current =
      (lowerSubject === "grapes" ? transition.lowerOpacity : 0) +
      (transition.upperIndex !== transition.lowerIndex &&
      upperSubject === "grapes"
        ? transition.upperOpacity
        : 0);

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

    const bottleInteraction = resolvedInteractionRef.current.bottle;
    bottleInteraction.renderedPitch = MathUtils.damp(
      bottleInteraction.renderedPitch,
      bottleInteraction.targetPitch,
      bottleInteraction.dragging ? 12 : 8,
      delta,
    );
    bottleInteraction.renderedYaw = MathUtils.damp(
      bottleInteraction.renderedYaw,
      bottleInteraction.targetYaw,
      bottleInteraction.dragging ? 12 : 8,
      delta,
    );
    if (bottleGroup.current) {
      bottleGroup.current.rotation.x =
        target.rotation[0] + bottleInteraction.renderedPitch;
      bottleGroup.current.rotation.y =
        target.rotation[1] + bottleInteraction.renderedYaw;
    }

    const grapeInteraction = resolvedInteractionRef.current.grapes;
    grapeInteraction.renderedPitch = MathUtils.damp(
      grapeInteraction.renderedPitch,
      grapeInteraction.targetPitch,
      grapeInteraction.dragging ? 12 : 8,
      delta,
    );
    grapeInteraction.renderedYaw = MathUtils.damp(
      grapeInteraction.renderedYaw,
      grapeInteraction.targetYaw,
      grapeInteraction.dragging ? 12 : 8,
      delta,
    );
    if (grapeGroup.current) {
      grapeGroup.current.rotation.x =
        target.rotation[0] + grapeInteraction.renderedPitch;
      grapeGroup.current.rotation.y =
        target.rotation[1] + grapeInteraction.renderedYaw;
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

    const control = resolvedInteractionRef.current.control;
    if (control.element && control.subject) {
      const group =
        control.subject === "bottle"
          ? bottleGroup.current
          : grapeGroup.current;
      if (group) {
        projectInteractionBounds(
          state.camera,
          control.element,
          group,
          projectionScratch.current,
          state.size.height,
          state.size.width,
        );
      }
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
