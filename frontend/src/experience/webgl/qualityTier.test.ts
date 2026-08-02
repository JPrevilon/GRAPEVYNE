import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  inspectBrowserWebGLCapability,
  selectWebGLQualityTier,
  type WebGLCapabilitySignals,
} from "./qualityTier";

const capableSignals: WebGLCapabilitySignals = {
  coarsePointer: false,
  deviceMemory: 8,
  hardwareConcurrency: 8,
  reducedMotion: false,
  saveData: false,
  viewportWidth: 1440,
  webglAvailable: true,
};

interface NavigatorCapabilityProperties {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

const originalNavigatorDescriptors = new Map<
  keyof NavigatorCapabilityProperties,
  PropertyDescriptor | undefined
>();

function setNavigatorCapability<K extends keyof NavigatorCapabilityProperties>(
  property: K,
  value: NavigatorCapabilityProperties[K],
) {
  Object.defineProperty(navigator, property, {
    configurable: true,
    value,
  });
}

describe("WebGL quality tier selection", () => {
  beforeEach(() => {
    (["connection", "deviceMemory", "hardwareConcurrency"] as const).forEach(
      (property) => {
        originalNavigatorDescriptors.set(
          property,
          Object.getOwnPropertyDescriptor(navigator, property),
        );
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();

    originalNavigatorDescriptors.forEach((descriptor, property) => {
      if (descriptor) {
        Object.defineProperty(navigator, property, descriptor);
      } else {
        Reflect.deleteProperty(navigator, property);
      }
    });
    originalNavigatorDescriptors.clear();
  });

  it.each([
    [
      "reduced motion",
      { reducedMotion: true },
      { reason: "reduced-motion", tier: "fallback" },
    ],
    [
      "Save-Data",
      { saveData: true },
      { reason: "save-data", tier: "fallback" },
    ],
    [
      "two gigabytes of memory",
      { deviceMemory: 2 },
      { reason: "low-capability", tier: "fallback" },
    ],
    [
      "two logical cores",
      { hardwareConcurrency: 2 },
      { reason: "low-capability", tier: "fallback" },
    ],
    [
      "an unavailable WebGL context",
      { webglAvailable: false },
      { reason: "webgl-unavailable", tier: "fallback" },
    ],
  ])("uses the CSS fallback for %s", (_label, overrides, expected) => {
    expect(
      selectWebGLQualityTier({ ...capableSignals, ...overrides }),
    ).toEqual(expected);
  });

  it("selects the high tier only for a capable fine-pointer desktop", () => {
    expect(selectWebGLQualityTier(capableSignals)).toEqual({
      reason: null,
      tier: "high",
    });
    expect(
      selectWebGLQualityTier({ ...capableSignals, viewportWidth: 1024 }),
    ).toEqual({ reason: null, tier: "high" });
  });

  it.each([
    ["mobile viewport", { viewportWidth: 430 }],
    ["coarse pointer", { coarsePointer: true }],
    ["midrange memory", { deviceMemory: 3 }],
    ["midrange CPU", { hardwareConcurrency: 4 }],
  ])("selects the standard tier for a capable %s", (_label, overrides) => {
    expect(
      selectWebGLQualityTier({ ...capableSignals, ...overrides }),
    ).toEqual({ reason: null, tier: "standard" });
  });

  it.each([
    ["reduced motion", true, false, 8],
    ["Save-Data", false, true, 8],
    ["known low hardware", false, false, 2],
  ])(
    "does not create a WebGL probe for the early %s fallback",
    (_label, reducedMotion, saveData, hardwareConcurrency) => {
      setNavigatorCapability("connection", { saveData });
      setNavigatorCapability("deviceMemory", 8);
      setNavigatorCapability("hardwareConcurrency", hardwareConcurrency);
      const contextSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "getContext",
      );

      const decision = inspectBrowserWebGLCapability(reducedMotion);

      expect(decision.tier).toBe("fallback");
      expect(contextSpy).not.toHaveBeenCalled();
    },
  );

  it("reports unavailable WebGL only after a capability-safe probe", () => {
    setNavigatorCapability("connection", { saveData: false });
    setNavigatorCapability("deviceMemory", 8);
    setNavigatorCapability("hardwareConcurrency", 8);
    const contextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => null);

    expect(inspectBrowserWebGLCapability(false)).toEqual({
      reason: "webgl-unavailable",
      tier: "fallback",
    });
    expect(contextSpy).toHaveBeenCalledTimes(2);
  });

  it("releases a successful probe context before choosing a tier", () => {
    setNavigatorCapability("connection", { saveData: false });
    setNavigatorCapability("deviceMemory", 8);
    setNavigatorCapability("hardwareConcurrency", 8);
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => ({ getExtension })) as unknown as HTMLCanvasElement["getContext"],
    );

    expect(inspectBrowserWebGLCapability(false)).toEqual({
      reason: null,
      tier: "high",
    });
    expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
    expect(loseContext).toHaveBeenCalledOnce();
  });
});
