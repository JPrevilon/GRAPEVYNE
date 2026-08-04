import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { RotateCcw, X } from "lucide-react";
import {
  Suspense,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { OrbitControls as OrbitControlsInstance } from "three-stdlib";

import { WineBottleFallback } from "@/components/wine/WineBottleFallback";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStoryStaticMode } from "@/hooks/useStoryStaticMode";

import MeshySubjectModel from "./MeshySubjectModel";
import { WebGLBoundary } from "./WebGLBoundary";
import type { WebGLQualityTier } from "./qualityTier";

interface BottleInspectorModalProps {
  onClose: () => void;
  returnFocus: HTMLElement | null;
}

interface ViewerSceneProps {
  controlsRef: MutableRefObject<OrbitControlsInstance | null>;
  onReady: () => void;
  tier: WebGLQualityTier;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function ViewerScene({ controlsRef, onReady, tier }: ViewerSceneProps) {
  const invalidate = useThree((state) => state.invalidate);
  const frameHandshakeRef = useRef(false);
  const opacityRef = useRef(1);

  useEffect(() => {
    controlsRef.current?.saveState();
    invalidate();
  }, [controlsRef, invalidate]);

  return (
    <>
      <hemisphereLight args={[0xf4e9d8, 0x07131c, 0.9]} />
      <spotLight
        angle={0.4}
        color={0xf4d9ad}
        decay={2}
        distance={10}
        intensity={3.6}
        penumbra={0.95}
        position={[3, 4, 4]}
      />
      <pointLight color={0xe1f0ff} intensity={0.8} position={[-2, 0.5, 3]} />
      <group scale={1.12}>
        <MeshySubjectModel
          frameHandshakeRef={frameHandshakeRef}
          kind="bottle"
          onRendered={onReady}
          opacityRef={opacityRef}
          tier={tier}
        />
      </group>
      <OrbitControls
        enableDamping={false}
        enablePan={false}
        maxDistance={5.6}
        maxPolarAngle={Math.PI / 2 + 0.2}
        minDistance={3.8}
        minPolarAngle={Math.PI / 2 - 0.2}
        ref={controlsRef}
        rotateSpeed={0.65}
        target={[0, 0, 0]}
        zoomSpeed={0.55}
      />
    </>
  );
}

export default function BottleInspectorModal({
  onClose,
  returnFocus,
}: BottleInspectorModalProps) {
  const mobile = useMediaQuery("(max-width: 720px)");
  const { reason: staticReason } = useStoryStaticMode();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<OrbitControlsInstance | null>(null);
  const tier: WebGLQualityTier = mobile ? "standard" : "high";
  // Reduced motion disables the cinematic runtime, but this viewer has no
  // automatic motion and remains available on explicit user request. Save-Data
  // continues to avoid the optional GLB download entirely.
  const useFallback = staticReason === "save-data" || failed;

  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>(".app-shell") as
      | (HTMLElement & { inert?: boolean })
      | null;
    const previousOverflow = document.body.style.overflow;
    const previousInert = appShell?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (appShell) appShell.inert = true;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appShell) appShell.inert = previousInert;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [onClose, returnFocus]);

  return createPortal(
    <div className="gv-bottle-inspector-layer">
      <div aria-hidden="true" className="gv-bottle-inspector-backdrop" />
      <div
        aria-describedby="bottle-inspector-description"
        aria-labelledby="bottle-inspector-title"
        aria-modal="true"
        className="gv-bottle-inspector"
        ref={dialogRef}
        role="dialog"
      >
        <header className="gv-bottle-inspector__header">
          <div>
            <p>PRIVATE VIEWER</p>
            <h2 id="bottle-inspector-title">INSPECT THE BOTTLE</h2>
          </div>
          <button onClick={onClose} ref={closeButtonRef} type="button">
            <X aria-hidden="true" size={19} />
            <span>CLOSE</span>
          </button>
        </header>

        <p className="gv-bottle-inspector__description" id="bottle-inspector-description">
          Drag to rotate. Pinch or scroll to zoom. Rotation and zoom are limited.
        </p>

        <div
          className={`gv-bottle-inspector__viewport${ready && !useFallback ? " is-ready" : ""}`}
          data-viewer-mode={useFallback ? staticReason ?? "fallback" : "interactive"}
        >
          <div aria-hidden="true" className="gv-bottle-inspector__fallback">
            <WineBottleFallback label="From Vine to Memory" tone="red" />
          </div>
          {!useFallback ? (
            <WebGLBoundary onError={() => setFailed(true)} resetKey={tier}>
              <Suspense fallback={null}>
                <Canvas
                  aria-hidden="true"
                  camera={{ far: 20, fov: 32, near: 0.1, position: [0, 0, 4.8] }}
                  dpr={tier === "high" ? [1, 1.5] : [1, 1.1]}
                  frameloop="demand"
                  gl={{
                    alpha: true,
                    antialias: tier === "high",
                    failIfMajorPerformanceCaveat: true,
                    powerPreference: "high-performance",
                    preserveDrawingBuffer: false,
                    stencil: false,
                  }}
                  style={{ background: "transparent", touchAction: "none" }}
                  tabIndex={-1}
                >
                  <ViewerScene
                    controlsRef={controlsRef}
                    onReady={() => setReady(true)}
                    tier={tier}
                  />
                </Canvas>
              </Suspense>
            </WebGLBoundary>
          ) : null}
        </div>

        <div className="gv-bottle-inspector__controls">
          <button
            disabled={useFallback}
            onClick={() => controlsRef.current?.reset()}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            RESET VIEW
          </button>
          {useFallback ? (
            <span role="status">
              Static bottle view{staticReason ? ` — ${staticReason.replace("-", " ")}` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
