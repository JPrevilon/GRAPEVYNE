import { Canvas, type RootState, useThree } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

import type { SceneProgress } from "@/experience/sceneContextValue";

import SceneRig from "./SceneRig";
import type { WebGLQualityTier } from "./qualityTier";

interface ExperienceCanvasProps {
  onFailure: (error: unknown) => void;
  onReady: () => void;
  onRecovering: () => void;
  storyProgressRef?: MutableRefObject<SceneProgress>;
  tier: WebGLQualityTier;
}

interface RendererLifecycleProps
  extends Omit<ExperienceCanvasProps, "onReady"> {
  frameHandshakeRef: MutableRefObject<boolean>;
}

const CONTEXT_RECOVERY_TIMEOUT_MS = 3500;

function configureRenderer(renderer: WebGLRenderer, tier: WebGLQualityTier) {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = tier === "high" ? 1.08 : 1;
}

function RendererLifecycle({
  frameHandshakeRef,
  onFailure,
  onRecovering,
  storyProgressRef,
  tier,
}: RendererLifecycleProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const contextLosses = useRef(0);
  const contextLost = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const sceneProgress = storyProgressRef?.current;
    let recoveryTimeout: number | undefined;

    const clearRecoveryTimeout = () => {
      if (recoveryTimeout !== undefined) {
        window.clearTimeout(recoveryTimeout);
        recoveryTimeout = undefined;
      }
    };

    const syncRenderActivity = (
      storyVisible = sceneProgress?.storyVisible ?? true,
    ) => {
      if (document.hidden || contextLost.current || !storyVisible) {
        setFrameloop("never");
      } else {
        setFrameloop("always");
        invalidate();
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLosses.current += 1;
      contextLost.current = true;
      frameHandshakeRef.current = false;
      onRecovering();
      setFrameloop("never");
      clearRecoveryTimeout();

      if (contextLosses.current > 1) {
        onFailure(new Error("WebGL context was lost more than once."));
        return;
      }

      recoveryTimeout = window.setTimeout(() => {
        onFailure(new Error("WebGL context did not recover in time."));
      }, CONTEXT_RECOVERY_TIMEOUT_MS);
    };

    const handleContextRestored = () => {
      if (contextLosses.current !== 1) return;

      clearRecoveryTimeout();
      configureRenderer(gl, tier);
      contextLost.current = false;
      frameHandshakeRef.current = false;

      syncRenderActivity();
    };

    const syncDocumentVisibility = () => {
      syncRenderActivity();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    document.addEventListener("visibilitychange", syncDocumentVisibility);

    if (sceneProgress) {
      sceneProgress.setRenderActivity = syncRenderActivity;
    }

    syncRenderActivity();

    return () => {
      clearRecoveryTimeout();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);

      if (
        sceneProgress?.setRenderActivity === syncRenderActivity
      ) {
        delete sceneProgress.setRenderActivity;
      }

      setFrameloop("never");
      // React StrictMode replays passive effects while the mounted canvas is
      // still connected. Release the context only after an actual DOM unmount;
      // R3F otherwise continues owning this live renderer.
      if (!canvas.isConnected) {
        gl.setAnimationLoop(null);
        gl.forceContextLoss();
      }
      frameHandshakeRef.current = false;
    };
  }, [
    frameHandshakeRef,
    gl,
    invalidate,
    onFailure,
    onRecovering,
    setFrameloop,
    storyProgressRef,
    tier,
  ]);

  return null;
}

export default function ExperienceCanvas({
  onFailure,
  onReady,
  onRecovering,
  storyProgressRef,
  tier,
}: ExperienceCanvasProps) {
  const frameHandshakeRef = useRef(false);
  const handleCreated = useCallback(
    ({ gl }: RootState) => {
      configureRenderer(gl, tier);
      gl.domElement.setAttribute("aria-hidden", "true");
      gl.domElement.tabIndex = -1;
    },
    [tier],
  );

  return (
    <Canvas
      aria-hidden="true"
      camera={{
        far: 30,
        fov: tier === "high" ? 34 : 38,
        near: 0.1,
        position: [0, 0, 7],
      }}
      dpr={tier === "high" ? [1, 1.5] : [1, 1.1]}
      frameloop="always"
      gl={{
        alpha: true,
        antialias: tier === "high",
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        premultipliedAlpha: true,
        stencil: false,
      }}
      onCreated={handleCreated}
      performance={{ max: 1, min: tier === "high" ? 0.72 : 0.58 }}
      resize={{ debounce: { resize: 80, scroll: 0 }, scroll: false }}
      style={{ background: "transparent", pointerEvents: "none" }}
    >
      <RendererLifecycle
        frameHandshakeRef={frameHandshakeRef}
        onFailure={onFailure}
        onRecovering={onRecovering}
        storyProgressRef={storyProgressRef}
        tier={tier}
      />
      <Suspense fallback={null}>
        <SceneRig
          frameHandshakeRef={frameHandshakeRef}
          onRendered={onReady}
          tier={tier}
        />
      </Suspense>
    </Canvas>
  );
}
