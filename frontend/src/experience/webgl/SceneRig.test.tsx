import { act, cleanup, render } from "@testing-library/react";
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  PerspectiveCamera,
  PointLight,
  SpotLight,
  type Object3D,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveStoryTransitionState,
  type StoryTransitionState,
} from "@/experience/storyTransition";

import {
  SUBJECT_PITCH_LIMITS,
  createSubjectInteractionState,
} from "./subjectInteraction";

interface FrameState {
  camera: PerspectiveCamera;
  clock: { elapsedTime: number };
  size: { height: number; width: number };
}

type FrameCallback = (state: FrameState, delta: number) => void;

const rigMock = vi.hoisted(() => ({
  frame: undefined as FrameCallback | undefined,
  injectedRefs: [] as Object3D[],
  opacityRefs: {} as Record<string, { current: number }>,
  subjectKinds: [] as string[],
}));

const sceneMock = vi.hoisted(() => ({
  progressRef: {
    current: {
      chapter: 0,
      story: 0,
      storyVisible: true,
      transition: {
        boundaryIndex: null,
        interactiveIndex: 0,
        lowerIndex: 0,
        lowerOpacity: 1,
        ownerIndex: 0,
        phase: "stable",
        segmentProgress: 0,
        transitionProgress: 0,
        upperIndex: 0,
        upperOpacity: 0,
        veilOpacity: 0,
      } as StoryTransitionState,
    },
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

function stepFrame(delta = 1 / 20) {
  const camera = new PerspectiveCamera(30, 1440 / 900, 0.1, 30);
  camera.position.set(0, 0, 8);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  act(() => {
    rigMock.frame?.(
      {
        camera,
        clock: { elapsedTime: 0 },
        size: { height: 900, width: 1440 },
      },
      delta,
    );
  });
}

function subjectOpacity(kind: "bottle" | "grapes") {
  const opacityRef = rigMock.opacityRefs[kind];
  if (!opacityRef) throw new Error(`Missing ${kind} opacity ref`);
  return opacityRef.current;
}

function setStableChapter(index: number) {
  sceneMock.progressRef.current.transition = deriveStoryTransitionState({
    overallProgress: index / 8,
  });
}

describe("SceneRig scroll-linked subjects", () => {
  beforeEach(() => {
    rigMock.frame = undefined;
    rigMock.injectedRefs = [];
    rigMock.opacityRefs = {};
    rigMock.subjectKinds = [];
    sceneMock.progressRef.current = {
      chapter: 0,
      story: 0,
      storyVisible: true,
      transition: deriveStoryTransitionState({ overallProgress: 0 }),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mounts exactly one bottle and one grape asset and projects the subject map", () => {
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

    setStableChapter(1);
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

    setStableChapter(2);
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
    createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    for (const progress of [0.0875, 0.098, 0.103, 0.109, 0.113, 0.12, 0.124]) {
      sceneMock.progressRef.current.transition = deriveStoryTransitionState({
        overallProgress: progress,
      });
      stepFrame();
      expect(
        subjectOpacity("bottle") * subjectOpacity("grapes"),
      ).toBe(0);
    }
  });

  it("swaps transforms at the hidden boundary in both scroll directions", () => {
    const objects = createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    sceneMock.progressRef.current.transition = {
      ...deriveStoryTransitionState({ overallProgress: 0.108 }),
      lowerOpacity: 0,
      ownerIndex: 1,
      phase: "black-hold",
      upperOpacity: 0,
      veilOpacity: 1,
    };
    stepFrame();
    expect(subjectOpacity("bottle")).toBe(0);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(false);
    expect(objects.grapes.visible).toBe(false);
    expect(objects.bottle.position.x).toBeCloseTo(0.72);

    sceneMock.progressRef.current.transition = deriveStoryTransitionState({
      overallProgress: 0.095,
    });
    stepFrame();
    expect(subjectOpacity("bottle")).toBeGreaterThan(0);
    expect(subjectOpacity("grapes")).toBe(0);
    expect(objects.bottle.visible).toBe(true);
    expect(objects.grapes.visible).toBe(false);
    expect(objects.bottle.position.x).toBeCloseTo(0.9);
  });

  it("applies damped additive rotation without leaking between subjects", () => {
    const objects = createRigObjects();
    const interactionRef = { current: createSubjectInteractionState() };
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        interactionRef={interactionRef}
        onRendered={vi.fn()}
        tier="high"
      />,
    );
    interactionRef.current.bottle.targetYaw = Math.PI * 2.5;
    interactionRef.current.bottle.targetPitch = SUBJECT_PITCH_LIMITS.bottle;
    for (let index = 0; index < 180; index += 1) stepFrame();

    expect(objects.bottle.rotation.y).toBeGreaterThan(Math.PI * 2);
    expect(objects.bottle.rotation.x).toBeGreaterThan(0);
    expect(interactionRef.current.grapes.renderedYaw).toBe(0);

    setStableChapter(1);
    interactionRef.current.grapes.targetYaw = -Math.PI * 2.5;
    for (let index = 0; index < 180; index += 1) stepFrame();
    expect(objects.grapes.rotation.y).toBeLessThan(-Math.PI * 2);
    expect(interactionRef.current.bottle.targetYaw).toBeGreaterThan(
      Math.PI * 2,
    );
  });

  it("does not attach a full-window pointer listener", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    createRigObjects();
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        onRendered={vi.fn()}
        tier="standard"
      />,
    );

    expect(
      addListener.mock.calls.some(([eventName]) => eventName === "pointermove"),
    ).toBe(false);
  });

  it("projects the live model bounds directly onto the semantic hit control", () => {
    const objects = createRigObjects();
    objects.bottle.add(new Mesh(new BoxGeometry(0.55, 2, 0.5)));
    const setFromObject = vi.spyOn(Box3.prototype, "setFromObject");
    const element = document.createElement("button");
    const interactionRef = { current: createSubjectInteractionState() };
    interactionRef.current.control = {
      cancel: vi.fn(),
      element,
      subject: "bottle",
    };
    render(
      <SceneRig
        frameHandshakeRef={{ current: false }}
        interactionRef={interactionRef}
        onRendered={vi.fn()}
        tier="high"
      />,
    );

    stepFrame();
    stepFrame();
    stepFrame();
    expect(setFromObject).toHaveBeenCalledTimes(1);
    expect(element).toHaveAttribute("data-projected-hit-area", "true");
    expect(Number.parseFloat(element.style.left)).toBeGreaterThan(0);
    expect(Number.parseFloat(element.style.top)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(element.style.width)).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(element.style.height)).toBeGreaterThanOrEqual(44);
    expect(
      Number.parseFloat(element.style.left) +
        Number.parseFloat(element.style.width),
    ).toBeLessThanOrEqual(1440);
  });
});
