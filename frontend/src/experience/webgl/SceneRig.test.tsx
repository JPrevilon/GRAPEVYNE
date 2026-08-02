import { act, cleanup, render } from "@testing-library/react";
import {
  Group,
  Mesh,
  PointLight,
  SpotLight,
  type Object3D,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOTTLE_SCENE_TARGETS, MAX_POINTER_PITCH, MAX_POINTER_YAW } from "./sceneTargets";

interface FrameState {
  clock: { elapsedTime: number };
}

type FrameCallback = (state: FrameState, delta: number) => void;

const rigMock = vi.hoisted(() => ({
  bottleRenders: 0,
  frame: undefined as FrameCallback | undefined,
  injectedRefs: [] as Object3D[],
}));

const sceneMock = vi.hoisted(() => ({
  chapter: "hero",
  chapterIndex: 0,
  progressRef: {
    current: { chapter: 0, story: 0, storyVisible: true },
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  function useRefWithInjectedThreeValue<Value>(initialValue: Value) {
    const storage = actual.useRef<
      { ref: { current: Value } } | undefined
    >(undefined);

    if (!storage.current) {
      if (initialValue === null && rigMock.injectedRefs.length > 0) {
        let heldValue = rigMock.injectedRefs.shift() as Value;
        const injectedRef = {} as { current: Value };

        Object.defineProperty(injectedRef, "current", {
          configurable: false,
          enumerable: true,
          get: () => heldValue,
          set: (nextValue: Value) => {
            if (nextValue === null || nextValue instanceof Element) return;
            heldValue = nextValue;
          },
        });
        storage.current = { ref: injectedRef };
      } else {
        storage.current = { ref: { current: initialValue } };
      }
    }

    return storage.current.ref;
  }

  return { ...actual, useRef: useRefWithInjectedThreeValue };
});

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: FrameCallback) => {
    rigMock.frame = callback;
  },
}));

vi.mock("@/experience/useScene", () => ({
  useScene: () => sceneMock,
}));

vi.mock("./BottleModel", () => ({
  default: () => {
    rigMock.bottleRenders += 1;
    return null;
  },
}));

import SceneRig from "./SceneRig";

interface RigObjects {
  chapter: Group;
  fillLight: PointLight;
  interaction: Group;
  keyLight: SpotLight;
  shadow: Mesh;
}

function createRigObjects(): RigObjects {
  const objects = {
    chapter: new Group(),
    fillLight: new PointLight(),
    interaction: new Group(),
    keyLight: new SpotLight(),
    shadow: new Mesh(),
  };

  rigMock.injectedRefs = [
    objects.interaction,
    objects.chapter,
    objects.keyLight,
    objects.fillLight,
    objects.shadow,
  ];
  return objects;
}

function installPointerMedia(matches: boolean) {
  return vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
    matches: query === "(pointer: fine)" && matches,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function stepFrames(count = 180) {
  act(() => {
    for (let index = 0; index < count; index += 1) {
      rigMock.frame?.({ clock: { elapsedTime: 0 } }, 1 / 20);
    }
  });
}

describe("SceneRig persistent motion", () => {
  beforeEach(() => {
    rigMock.bottleRenders = 0;
    rigMock.frame = undefined;
    rigMock.injectedRefs = [];
    sceneMock.chapter = "hero";
    sceneMock.chapterIndex = 0;
    sceneMock.progressRef.current = {
      chapter: 0,
      story: 0,
      storyVisible: true,
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("attaches one passive fine-pointer listener for high tier and removes it", () => {
    installPointerMedia(true);
    createRigObjects();
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const view = render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="high"
      />,
    );
    const pointerRegistration = addListener.mock.calls.find(
      ([eventName]) => eventName === "pointermove",
    );

    expect(pointerRegistration).toBeDefined();
    expect(pointerRegistration?.[2]).toEqual({ passive: true });
    expect(window.matchMedia).toHaveBeenCalledWith("(pointer: fine)");

    view.unmount();
    expect(removeListener).toHaveBeenCalledWith(
      "pointermove",
      pointerRegistration?.[1],
    );
  });

  it("never probes or attaches pointer motion for the standard tier", () => {
    const matchMedia = installPointerMedia(true);
    createRigObjects();
    const addListener = vi.spyOn(window, "addEventListener");

    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    expect(matchMedia).not.toHaveBeenCalled();
    expect(
      addListener.mock.calls.some(([eventName]) => eventName === "pointermove"),
    ).toBe(false);
  });

  it("clamps pointer motion into refs and advances frames without React renders", () => {
    installPointerMedia(true);
    const objects = createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="high"
      />,
    );

    const pointerEvent = new MouseEvent("pointermove", {
      clientX: window.innerWidth * 20,
      clientY: -window.innerHeight * 20,
    });
    Object.defineProperty(pointerEvent, "pointerType", { value: "mouse" });
    window.dispatchEvent(pointerEvent);
    stepFrames();

    expect(objects.interaction.rotation.y).toBeGreaterThan(0);
    expect(objects.interaction.rotation.y).toBeLessThanOrEqual(MAX_POINTER_YAW);
    expect(objects.interaction.rotation.x).toBeGreaterThan(0);
    expect(objects.interaction.rotation.x).toBeLessThanOrEqual(
      MAX_POINTER_PITCH,
    );
    expect(objects.keyLight.intensity).toBeCloseTo(
      BOTTLE_SCENE_TARGETS.high.hero.keyLight * 0.8,
      3,
    );
    expect(objects.fillLight.intensity).toBeCloseTo(1.2, 3);
    expect(rigMock.bottleRenders).toBe(1);
  });

  it("interpolates forward and reverses smoothly through the same target boundary", () => {
    installPointerMedia(false);
    const objects = createRigObjects();
    const view = render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );
    const discoveryTarget = BOTTLE_SCENE_TARGETS.standard.discovery;
    const heroTarget = BOTTLE_SCENE_TARGETS.standard.hero;

    sceneMock.progressRef.current.chapter = 1;
    stepFrames();
    expect(objects.interaction.position.x).toBeCloseTo(
      discoveryTarget.position[0],
      3,
    );
    expect(objects.interaction.position.y).toBeCloseTo(
      discoveryTarget.position[1],
      3,
    );
    expect(objects.interaction.scale.x).toBeCloseTo(discoveryTarget.scale, 3);
    expect(objects.chapter.rotation.y).toBeCloseTo(
      discoveryTarget.rotation[1],
      3,
    );
    expect(objects.keyLight.intensity).toBeCloseTo(
      discoveryTarget.keyLight * 0.76,
      3,
    );
    expect(objects.fillLight.intensity).toBeCloseTo(0.8, 3);

    sceneMock.chapter = "discovery";
    sceneMock.chapterIndex = 1;
    sceneMock.progressRef.current.chapter = 0;
    view.rerender(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );
    stepFrames();
    expect(objects.interaction.position.x).toBeCloseTo(
      discoveryTarget.position[0],
      3,
    );

    sceneMock.chapter = "hero";
    sceneMock.chapterIndex = 0;
    sceneMock.progressRef.current.chapter = 1;
    view.rerender(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );
    stepFrames(1);
    expect(objects.interaction.position.x).toBeCloseTo(
      discoveryTarget.position[0],
      3,
    );

    sceneMock.progressRef.current.chapter = 0;
    stepFrames();
    expect(objects.interaction.position.x).toBeCloseTo(heroTarget.position[0], 3);
    expect(objects.interaction.position.y).toBeCloseTo(heroTarget.position[1], 3);
    expect(objects.interaction.scale.x).toBeCloseTo(heroTarget.scale, 3);
    expect(objects.chapter.rotation.y).toBeCloseTo(heroTarget.rotation[1], 3);
  });
});
