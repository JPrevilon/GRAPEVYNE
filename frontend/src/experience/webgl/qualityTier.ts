export type WebGLQualityTier = "high" | "standard";

export type WebGLFallbackReason =
  | "reduced-motion"
  | "save-data"
  | "low-capability"
  | "webgl-unavailable";

export type WebGLCapabilityDecision =
  | {
      reason: null;
      tier: WebGLQualityTier;
    }
  | {
      reason: WebGLFallbackReason;
      tier: "fallback";
    };

export interface WebGLCapabilitySignals {
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  reducedMotion: boolean;
  saveData: boolean;
  viewportWidth: number;
  webglAvailable: boolean;
}

const LOW_MEMORY_GB = 2;
const LOW_CORE_COUNT = 2;
const HIGH_MEMORY_GB = 4;
const HIGH_CORE_COUNT = 6;
const HIGH_TIER_MIN_WIDTH = 1024;

export function selectWebGLQualityTier(
  signals: WebGLCapabilitySignals,
): WebGLCapabilityDecision {
  if (signals.reducedMotion) {
    return { reason: "reduced-motion", tier: "fallback" };
  }

  if (signals.saveData) {
    return { reason: "save-data", tier: "fallback" };
  }

  if (
    (signals.deviceMemory !== undefined &&
      signals.deviceMemory <= LOW_MEMORY_GB) ||
    (signals.hardwareConcurrency !== undefined &&
      signals.hardwareConcurrency <= LOW_CORE_COUNT)
  ) {
    return { reason: "low-capability", tier: "fallback" };
  }

  if (!signals.webglAvailable) {
    return { reason: "webgl-unavailable", tier: "fallback" };
  }

  const hasHighTierMemory =
    signals.deviceMemory === undefined ||
    signals.deviceMemory >= HIGH_MEMORY_GB;
  const hasHighTierCores =
    signals.hardwareConcurrency === undefined ||
    signals.hardwareConcurrency >= HIGH_CORE_COUNT;
  const isHighTierViewport =
    signals.viewportWidth >= HIGH_TIER_MIN_WIDTH && !signals.coarsePointer;

  return isHighTierViewport && hasHighTierMemory && hasHighTierCores
    ? { reason: null, tier: "high" }
    : { reason: null, tier: "standard" };
}

interface NavigatorWithCapabilityHints extends Navigator {
  connection?: {
    saveData?: boolean;
  };
  deviceMemory?: number;
}

function releaseProbeContext(context: WebGLRenderingContext | WebGL2RenderingContext) {
  context.getExtension("WEBGL_lose_context")?.loseContext();
}

function probeWebGLSupport() {
  const canvas = document.createElement("canvas");
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
    stencil: false,
  };

  try {
    const context =
      canvas.getContext("webgl2", attributes) ??
      canvas.getContext("webgl", attributes);

    if (!context) return false;

    releaseProbeContext(context);
    return true;
  } catch {
    return false;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    canvas.remove();
  }
}

/**
 * Runs before the Three.js chunk is requested. Reduced motion, Save-Data, and
 * known-low hardware return before a WebGL context is ever probed.
 */
export function inspectBrowserWebGLCapability(
  reducedMotion: boolean,
): WebGLCapabilityDecision {
  const browserNavigator = navigator as NavigatorWithCapabilityHints;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const baseSignals = {
    coarsePointer,
    deviceMemory: browserNavigator.deviceMemory,
    hardwareConcurrency: browserNavigator.hardwareConcurrency,
    reducedMotion,
    saveData: browserNavigator.connection?.saveData === true,
    viewportWidth: window.innerWidth,
  };

  const earlyDecision = selectWebGLQualityTier({
    ...baseSignals,
    webglAvailable: true,
  });

  if (earlyDecision.tier === "fallback") return earlyDecision;

  return selectWebGLQualityTier({
    ...baseSignals,
    webglAvailable: probeWebGLSupport(),
  });
}
