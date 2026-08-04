import { act, cleanup, render } from "@testing-library/react";
import {
  Group,
  Mesh,
  PointLight,
  SpotLight,
  type Object3D,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_POINTER_PITCH, MAX_POINTER_YAW } from "./sceneTargets";

interface FrameState {
  clock: { elapsedTime: number };
}

type FrameCallback = (state: FrameState, delta: number) => void;

const rigMock = vi.hoisted(() => ({
  frame: undefined as FrameCallback | undefined,
  injectedRefs: [] as Object3D[],
  opacityRefs: {} as Record<string, { current: number }>,
  subjectKinds: [] as string[],
}));

const sceneMock = vi.hoisted(() => ({
  chapter: "hero",
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

vi.mock("./MeshySubjectModel", () => ({
  default: ({
    kind,
    opacityRef,
  }: {
    kind: string;
    opacityRef: { current: number };
  }) => {
    rigMock.subjectKinds.push(kind);
    rigMock.opacityRefs[kind] = opacityRef;
    return null;
  },
}));

import SceneRig from "./SceneRig";

interface RigObjects {
  bottle: Group;
  fillLight: PointLight;
  grapes: Group;
  keyLight: SpotLight;
  shadow: Mesh;
}

function createRigObjects(): RigObjects {
  const objects = {
    bottle: new Group(),
    fillLight: new PointLight(),
    grapes: new Group(),
    keyLight: new SpotLight(),
    shadow: new Mesh(),
  };

  rigMock.injectedRefs = [
    objects.bottle,
    objects.grapes,
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

function stepFrame(delta = 1 / 20) {
  act(() => {
    rigMock.frame?.({ clock: { elapsedTime: 0 } }, delta);
  });
}

function subjectOpacity(kind: "bottle" | "grapes") {
  const opacityRef = rigMock.opacityRefs[kind];
  if (!opacityRef) throw new Error(`Missing ${kind} opacity ref`);
  return opacityRef.current;
}

describe("SceneRig scroll-linked subjects", () => {
  beforeEach(() => {
    rigMock.frame = undefined;
    rigMock.injectedRefs = [];
    rigMock.opacityRefs = {};
    rigMock.subjectKinds = [];
    sceneMock.chapter = "hero";
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

  it("mounts exactly one bottle and one grape asset and projects the subject map", () => {
    installPointerMedia(false);
    const objects = createRigObjects();
    const view = render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    expect(rigMock.subjectKinds).toEqual(["bottle", "grapes"]);

    stepFrame();
    expect(subjectOpacity("bottle")).toBe(1);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(true);
    expect(objects.grapes.visible).toBe(false);

    sceneMock.chapter = "discovery";
    sceneMock.progressRef.current.chapter = 0;
    view.rerender(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );
    stepFrame();
    expect(subjectOpacity("bottle")).toBe(0);
    expect(subjectOpacity("grapes")).toBe(1);
    expect(objects.bottle.visible).toBe(false);
    expect(objects.grapes.visible).toBe(true);

    sceneMock.chapter = "match";
    view.rerender(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );
    stepFrame();
    expect(subjectOpacity("bottle")).toBe(0);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(false);
    expect(objects.grapes.visible).toBe(false);
  });

  it("keeps bottle and grapes mutually exclusive through a chapter handoff", () => {
    installPointerMedia(false);
    createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    for (const progress of [0, 0.68, 0.75, 0.82, 0.9, 0.95, 1]) {
      sceneMock.progressRef.current.chapter = progress;
      stepFrame();
      expect(
        subjectOpacity("bottle") * subjectOpacity("grapes"),
      ).toBe(0);
    }
  });

  it("swaps transforms at the hidden boundary in both scroll directions", () => {
    installPointerMedia(false);
    const objects = createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    sceneMock.progressRef.current.chapter = 0.86;
    stepFrame();
    expect(subjectOpacity("bottle")).toBe(0);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(false);
    expect(objects.grapes.visible).toBe(false);
    expect(objects.bottle.position.x).toBeCloseTo(0.72);

    sceneMock.progressRef.current.chapter = 0.75;
    stepFrame();
    expect(subjectOpacity("bottle")).toBeGreaterThan(0);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(true);
    expect(objects.grapes.visible).toBe(false);
    expect(objects.bottle.position.x).toBeCloseTo(0.9);
  });

  it("attaches fine-pointer motion only on the high tier and removes it", () => {
    installPointerMedia(true);
    const objects = createRigObjects();
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

    expect(pointerRegistration?.[2]).toEqual({ passive: true });

    const pointerEvent = new MouseEvent("pointermove", {
      clientX: window.innerWidth * 20,
      clientY: -window.innerHeight * 20,
    });
    Object.defineProperty(pointerEvent, "pointerType", { value: "mouse" });
    window.dispatchEvent(pointerEvent);
    for (let index = 0; index < 180; index += 1) stepFrame();

    expect(objects.bottle.rotation.y).toBeGreaterThan(0.06);
    expect(objects.bottle.rotation.y - 0.06).toBeLessThanOrEqual(
      MAX_POINTER_YAW + Number.EPSILON,
    );
    expect(objects.bottle.rotation.x).toBeGreaterThan(0);
    expect(objects.bottle.rotation.x).toBeLessThanOrEqual(MAX_POINTER_PITCH);

    view.unmount();
    expect(removeListener).toHaveBeenCalledWith(
      "pointermove",
      pointerRegistration?.[1],
    );
  });

  it("does not probe for pointer motion on the standard tier", () => {
    const matchMedia = installPointerMedia(true);
    createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    expect(matchMedia).not.toHaveBeenCalled();
  });
});
