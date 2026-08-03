import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useScene } from "@/experience/useScene";

import {
  inspectBrowserWebGLCapability,
  type WebGLCapabilityDecision,
} from "./qualityTier";
import { WebGLBoundary } from "./WebGLBoundary";

const LazyExperienceCanvas = lazy(() => import("./ExperienceCanvas"));

type WebGLStatus = "loading" | "ready" | "recovering" | "failed";

interface WebGLExperienceProps {
  onReadyChange: (ready: boolean) => void;
}

interface IdleWindow {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
}

const WEBGL_IMPORT_MARK = "grapevyne-webgl-import-requested";
const WEBGL_FIRST_FRAME_MARK = "grapevyne-webgl-first-frame";

function markPerformance(name: string, detail?: unknown) {
  if (typeof performance.mark !== "function") return;

  if (detail === undefined) {
    performance.mark(name);
    return;
  }

  performance.mark(name, { detail });
}

export default function WebGLExperience({
  onReadyChange,
}: WebGLExperienceProps) {
  const { homepageActive, prefersReducedMotion, progressRef } = useScene();
  const [decision, setDecision] = useState<WebGLCapabilityDecision | null>(null);
  const [activated, setActivated] = useState(false);
  const [status, setStatus] = useState<WebGLStatus>("loading");
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!homepageActive) {
      setDecision(null);
      setActivated(false);
      setStatus("loading");
      return;
    }

    markPerformance("grapevyne-webgl-capability-start");
    const nextDecision = inspectBrowserWebGLCapability(prefersReducedMotion);
    markPerformance("grapevyne-webgl-capability-decided", nextDecision);
    setDecision(nextDecision);
    setActivated(false);
    setStatus("loading");
  }, [homepageActive, prefersReducedMotion]);

  useLayoutEffect(() => {
    onReadyChange(status === "ready" && activated);
  }, [activated, onReadyChange, status]);

  useEffect(() => {
    if (decision?.tier === "fallback" || decision === null) return undefined;

    const idleWindow = window as IdleWindow;
    let animationFrame: number | undefined;
    let idleCallback: number | undefined;
    let timeout: number | undefined;
    let cancelled = false;

    const activate = () => {
      if (!cancelled) {
        markPerformance(WEBGL_IMPORT_MARK);
        setActivated(true);
      }
    };

    animationFrame = window.requestAnimationFrame(() => {
      if (idleWindow.requestIdleCallback) {
        idleCallback = idleWindow.requestIdleCallback(activate, { timeout: 700 });
      } else {
        timeout = window.setTimeout(activate, 0);
      }
    });

    return () => {
      cancelled = true;

      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }

      if (idleCallback !== undefined) {
        idleWindow.cancelIdleCallback?.(idleCallback);
      }

      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [decision]);

  useEffect(() => {
    const layer = layerRef.current as
      | (HTMLDivElement & { inert?: boolean })
      | null;

    if (layer) layer.inert = true;
  }, [activated]);

  const markReady = useCallback(() => {
    if (
      typeof performance.getEntriesByName !== "function" ||
      performance.getEntriesByName(WEBGL_FIRST_FRAME_MARK).length === 0
    ) {
      markPerformance(WEBGL_FIRST_FRAME_MARK);

      if (typeof performance.measure === "function") {
        try {
          performance.measure(
            "grapevyne-webgl-time-to-first-frame",
            WEBGL_IMPORT_MARK,
            WEBGL_FIRST_FRAME_MARK,
          );
        } catch {
          // A missing mark must never interfere with the fallback handshake.
        }
      }
    }

    setStatus("ready");
  }, []);

  const markRecovering = useCallback(() => {
    setStatus("recovering");
  }, []);

  const markFailed = useCallback((_error: unknown) => {
    if (import.meta.env.DEV) {
      const message =
        _error instanceof Error ? _error.message : "Unknown renderer failure";
      console.warn(`[GRAPEVYNE WebGL] CSS fallback restored: ${message}`);
    }

    setStatus("failed");
    setActivated(false);
  }, []);

  if (
    !homepageActive ||
    !activated ||
    decision === null ||
    decision.tier === "fallback"
  ) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`gv-webgl-experience gv-webgl-experience--${status}`}
      data-webgl-status={status}
      data-webgl-tier={decision.tier}
      ref={layerRef}
    >
      <WebGLBoundary
        onError={markFailed}
        resetKey={`${decision.tier}:${status}`}
      >
        <Suspense fallback={null}>
          <LazyExperienceCanvas
            onFailure={markFailed}
            onReady={markReady}
            onRecovering={markRecovering}
            storyProgressRef={progressRef}
            tier={decision.tier}
          />
        </Suspense>
      </WebGLBoundary>
    </div>
  );
}
