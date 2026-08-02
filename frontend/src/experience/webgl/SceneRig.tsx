import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useRef } from "react";
import {
  Group,
  MathUtils,
  PointLight,
  SpotLight,
  type Mesh,
} from "three";

import { STORY_CHAPTER_KEYS } from "@/experience/storyChapters";
import { useScene } from "@/experience/useScene";

import BottleModel from "./BottleModel";
import { getClampedPointerRotation } from "./pointerMotion";
import type { WebGLQualityTier } from "./qualityTier";
import { BOTTLE_SCENE_TARGETS } from "./sceneTargets";

interface SceneRigProps {
  frameHandshakeRef: MutableRefObject<boolean>;
  onRendered: () => void;
  tier: WebGLQualityTier;
}

function smoothChapterBlend(progress: number) {
  const normalized = MathUtils.clamp((progress - 0.62) / 0.38, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

export default function SceneRig({
  frameHandshakeRef,
  onRendered,
  tier,
}: SceneRigProps) {
  const { chapter, chapterIndex, progressRef } = useScene();
  const interactionGroup = useRef<Group>(null);
  const chapterGroup = useRef<Group>(null);
  const keyLight = useRef<SpotLight>(null);
  const accentLight = useRef<PointLight>(null);
  const shadow = useRef<Mesh>(null);
  const pointerYaw = useRef(0);
  const pointerPitch = useRef(0);
  const targets = BOTTLE_SCENE_TARGETS[tier];
  const currentTarget = targets[chapter];
  const nextChapter =
    STORY_CHAPTER_KEYS[
      Math.min(chapterIndex + 1, STORY_CHAPTER_KEYS.length - 1)
    ] ?? chapter;
  const nextTarget = targets[nextChapter];

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

  useFrame(({ clock }, rawDelta) => {
    const interaction = interactionGroup.current;
    const chapterMotion = chapterGroup.current;

    if (!interaction || !chapterMotion) return;

    const delta = Math.min(rawDelta, 1 / 20);
    const blend = smoothChapterBlend(progressRef.current.chapter);
    const targetX = MathUtils.lerp(
      currentTarget.position[0],
      nextTarget.position[0],
      blend,
    );
    const targetY = MathUtils.lerp(
      currentTarget.position[1],
      nextTarget.position[1],
      blend,
    );
    const targetZ = MathUtils.lerp(
      currentTarget.position[2],
      nextTarget.position[2],
      blend,
    );
    const targetScale = MathUtils.lerp(
      currentTarget.scale,
      nextTarget.scale,
      blend,
    );
    const idleYaw = Math.sin(clock.elapsedTime * 0.42) * 0.012;
    const idleLift = Math.sin(clock.elapsedTime * 0.34) * 0.012;

    interaction.visible =
      progressRef.current.storyVisible &&
      currentTarget.visible &&
      nextTarget.visible;
    interaction.position.x = MathUtils.damp(
      interaction.position.x,
      targetX,
      4.1,
      delta,
    );
    interaction.position.y = MathUtils.damp(
      interaction.position.y,
      targetY + idleLift,
      4.1,
      delta,
    );
    interaction.position.z = MathUtils.damp(
      interaction.position.z,
      targetZ,
      4.1,
      delta,
    );
    const dampedScale = MathUtils.damp(
      interaction.scale.x,
      targetScale,
      4,
      delta,
    );
    interaction.scale.setScalar(dampedScale);
    interaction.rotation.x = MathUtils.damp(
      interaction.rotation.x,
      pointerPitch.current,
      5,
      delta,
    );
    interaction.rotation.y = MathUtils.damp(
      interaction.rotation.y,
      pointerYaw.current + idleYaw,
      5,
      delta,
    );

    chapterMotion.rotation.x = MathUtils.damp(
      chapterMotion.rotation.x,
      MathUtils.lerp(
        currentTarget.rotation[0],
        nextTarget.rotation[0],
        blend,
      ),
      3.8,
      delta,
    );
    chapterMotion.rotation.y = MathUtils.damp(
      chapterMotion.rotation.y,
      MathUtils.lerp(
        currentTarget.rotation[1],
        nextTarget.rotation[1],
        blend,
      ),
      3.8,
      delta,
    );
    chapterMotion.rotation.z = MathUtils.damp(
      chapterMotion.rotation.z,
      MathUtils.lerp(
        currentTarget.rotation[2],
        nextTarget.rotation[2],
        blend,
      ),
      3.8,
      delta,
    );

    if (keyLight.current) {
      keyLight.current.intensity = MathUtils.damp(
        keyLight.current.intensity,
        MathUtils.lerp(currentTarget.keyLight, nextTarget.keyLight, blend),
        3.5,
        delta,
      );
    }

    if (accentLight.current) {
      accentLight.current.intensity = MathUtils.damp(
        accentLight.current.intensity,
        tier === "high" ? 1.75 : 1.2,
        3.5,
        delta,
      );
    }

    if (shadow.current) {
      const decoration = MathUtils.lerp(
        currentTarget.decoration,
        nextTarget.decoration,
        blend,
      );
      const shadowScale = MathUtils.damp(
        shadow.current.scale.x,
        decoration,
        3.5,
        delta,
      );
      shadow.current.scale.setScalar(shadowScale);
      shadow.current.visible =
        tier === "high" && interaction.visible && decoration > 0.02;
    }
  });

  return (
    <>
      <hemisphereLight args={[0xefe5d1, 0x140b0e, tier === "high" ? 1.3 : 1]} />
      <spotLight
        angle={0.42}
        color={0xf0d2a0}
        decay={1.6}
        distance={12}
        intensity={currentTarget.keyLight}
        penumbra={0.86}
        position={[3.4, 4.8, 5.2]}
        ref={keyLight}
      />
      <pointLight
        color={0x8e1738}
        decay={1.8}
        distance={9}
        intensity={tier === "high" ? 1.75 : 1.2}
        position={[-3.2, 0.4, 2.8]}
        ref={accentLight}
      />
      {tier === "high" ? (
        <directionalLight
          color={0xd8e1cb}
          intensity={0.78}
          position={[-2.4, 2.8, 3.6]}
        />
      ) : null}

      <group
        position={currentTarget.position}
        ref={interactionGroup}
        scale={currentTarget.scale}
      >
        <group
          ref={chapterGroup}
          rotation={[
            currentTarget.rotation[0],
            currentTarget.rotation[1],
            currentTarget.rotation[2],
          ]}
        >
          {tier === "high" ? (
            <mesh position={[0, -0.012, 0]} ref={shadow} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.5, 48]} />
              <meshBasicMaterial
                color={0x000000}
                depthWrite={false}
                opacity={0.28}
                transparent
              />
            </mesh>
          ) : null}
          <group rotation-x={-Math.PI / 2}>
            <BottleModel
              frameHandshakeRef={frameHandshakeRef}
              onRendered={onRendered}
              tier={tier}
            />
          </group>
        </group>
      </group>
    </>
  );
}
