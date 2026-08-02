import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  StrictMode,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneProgress } from "@/experience/sceneContextValue";

interface MockCanvasProps {
  "aria-hidden"?: boolean | "true";
  children?: ReactNode;
  dpr?: number | [number, number];
  frameloop?: string;
  gl?: Record<string, unknown>;
  onCreated?: (state: unknown) => void;
  style?: CSSProperties;
}

const fiberMock = vi.hoisted(() => ({
  canvasProps: null as MockCanvasProps | null,
  gl: {
    domElement: null as HTMLCanvasElement | null,
    forceContextLoss: vi.fn(),
    outputColorSpace: "",
    setAnimationLoop: vi.fn(),
    setClearColor: vi.fn(),
    toneMapping: 0,
    toneMappingExposure: 0,
  },
  invalidate: vi.fn(),
  setFrameloop: vi.fn(),
}));

vi.mock("@react-three/fiber", async () => {
  const { createElement, Fragment, useLayoutEffect, useRef } = await import(
    "react"
  );

  return {
    Canvas: (props: MockCanvasProps) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const { onCreated } = props;
      fiberMock.canvasProps = props;

      useLayoutEffect(() => {
        if (!canvasRef.current) return;

        fiberMock.gl.domElement = canvasRef.current;
        onCreated?.({
          gl: fiberMock.gl,
          invalidate: fiberMock.invalidate,
          setFrameloop: fiberMock.setFrameloop,
        });
      }, [onCreated]);

      return createElement(
        Fragment,
        null,
        createElement("canvas", {
          "aria-hidden": props["aria-hidden"],
          ref: canvasRef,
          style: props.style,
        }),
        props.children,
      );
    },
    useThree: <Selected,>(
      selector: (state: {
        gl: typeof fiberMock.gl;
        invalidate: typeof fiberMock.invalidate;
        setFrameloop: typeof fiberMock.setFrameloop;
      }) => Selected,
    ) =>
      selector({
        gl: fiberMock.gl,
        invalidate: fiberMock.invalidate,
        setFrameloop: fiberMock.setFrameloop,
      }),
  };
});

vi.mock("./SceneRig", async () => {
  const { createElement } = await import("react");

  return {
    default: (props: {
      frameHandshakeRef: { current: boolean };
      onRendered: () => void;
    }) =>
      createElement(
        "button",
        {
          onClick: () => {
            if (props.frameHandshakeRef.current) return;
            props.frameHandshakeRef.current = true;
            props.onRendered();
          },
          type: "button",
        },
        "complete model frame",
      ),
  };
});

import ExperienceCanvas from "./ExperienceCanvas";

const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "hidden",
);

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
}

function createStoryProgressRef(
  storyVisible = true,
): MutableRefObject<SceneProgress> {
  return {
    current: { chapter: 0, story: 0, storyVisible },
  };
}

describe("ExperienceCanvas renderer lifecycle", () => {
  beforeEach(() => {
    fiberMock.canvasProps = null;
    fiberMock.gl.domElement = null;
    fiberMock.gl.forceContextLoss.mockClear();
    fiberMock.gl.outputColorSpace = "";
    fiberMock.gl.setAnimationLoop.mockClear();
    fiberMock.gl.setClearColor.mockClear();
    fiberMock.gl.toneMapping = 0;
    fiberMock.gl.toneMappingExposure = 0;
    fiberMock.invalidate.mockClear();
    fiberMock.setFrameloop.mockClear();
    setDocumentHidden(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();

    if (originalHiddenDescriptor) {
      Object.defineProperty(document, "hidden", originalHiddenDescriptor);
    } else {
      Reflect.deleteProperty(document, "hidden");
    }
  });

  it("creates one transparent inert high-tier canvas and waits for a real frame", async () => {
    const onFailure = vi.fn();
    const onReady = vi.fn();
    const view = render(
      <ExperienceCanvas
        onFailure={onFailure}
        onReady={onReady}
        onRecovering={vi.fn()}
        storyProgressRef={createStoryProgressRef()}
        tier="high"
      />,
    );

    await waitFor(() => expect(fiberMock.gl.setClearColor).toHaveBeenCalled());
    const canvas = view.container.querySelector("canvas");

    expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveAttribute("tabindex", "-1");
    expect(canvas).toHaveStyle({ background: "transparent", pointerEvents: "none" });
    expect(fiberMock.canvasProps?.dpr).toEqual([1, 1.5]);
    expect(fiberMock.canvasProps?.frameloop).toBe("always");
    expect(fiberMock.canvasProps?.gl).toMatchObject({
      alpha: true,
      antialias: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    });
    expect(fiberMock.gl.outputColorSpace).toBe(SRGBColorSpace);
    expect(fiberMock.gl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(fiberMock.gl.toneMappingExposure).toBe(1.08);
    expect(onReady).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "complete model frame" }));
    fireEvent.click(screen.getByRole("button", { name: "complete model frame" }));
    expect(onReady).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();

    view.unmount();
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("never");
    expect(fiberMock.gl.setAnimationLoop).toHaveBeenCalledOnce();
    expect(fiberMock.gl.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(fiberMock.gl.forceContextLoss).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("uses the bounded DPR and cheaper renderer settings for standard mobile", async () => {
    render(
      <ExperienceCanvas
        onFailure={vi.fn()}
        onReady={vi.fn()}
        onRecovering={vi.fn()}
        storyProgressRef={createStoryProgressRef()}
        tier="standard"
      />,
    );

    await waitFor(() => expect(fiberMock.gl.setClearColor).toHaveBeenCalled());
    expect(fiberMock.canvasProps?.dpr).toEqual([1, 1.1]);
    expect(fiberMock.canvasProps?.gl).toMatchObject({ antialias: false });
    expect(fiberMock.gl.toneMapping).toBe(ACESFilmicToneMapping);
    expect(fiberMock.gl.toneMappingExposure).toBe(1);
  });

  it("keeps a connected renderer through Strict Effects and releases it on DOM unmount", async () => {
    const onFailure = vi.fn();
    const storyProgressRef = createStoryProgressRef();
    const view = render(
      <StrictMode>
        <ExperienceCanvas
          onFailure={onFailure}
          onReady={vi.fn()}
          onRecovering={vi.fn()}
          storyProgressRef={storyProgressRef}
          tier="high"
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(storyProgressRef.current.setRenderActivity).toBeTypeOf("function");
    });
    expect(fiberMock.gl.domElement?.isConnected).toBe(true);
    expect(fiberMock.gl.setAnimationLoop).not.toHaveBeenCalled();
    expect(fiberMock.gl.forceContextLoss).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    view.unmount();
    expect(fiberMock.gl.domElement?.isConnected).toBe(false);
    expect(fiberMock.gl.setAnimationLoop).toHaveBeenCalledOnce();
    expect(fiberMock.gl.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(fiberMock.gl.forceContextLoss).toHaveBeenCalledOnce();
    expect(storyProgressRef.current.setRenderActivity).toBeUndefined();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("pauses while hidden, resumes while visible, and removes visibility work", async () => {
    const view = render(
      <ExperienceCanvas
        onFailure={vi.fn()}
        onReady={vi.fn()}
        onRecovering={vi.fn()}
        storyProgressRef={createStoryProgressRef()}
        tier="high"
      />,
    );

    await waitFor(() => {
      expect(fiberMock.setFrameloop).toHaveBeenCalledWith("always");
    });
    fiberMock.setFrameloop.mockClear();
    fiberMock.invalidate.mockClear();

    setDocumentHidden(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("never");

    setDocumentHidden(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("always");
    expect(fiberMock.invalidate).toHaveBeenCalledOnce();

    view.unmount();
    const callsAfterUnmount = fiberMock.setFrameloop.mock.calls.length;
    fireEvent(document, new Event("visibilitychange"));
    expect(fiberMock.setFrameloop).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it("bridges story visibility to render activity and removes the bridge on cleanup", async () => {
    const storyProgressRef = createStoryProgressRef(false);
    const view = render(
      <ExperienceCanvas
        onFailure={vi.fn()}
        onReady={vi.fn()}
        onRecovering={vi.fn()}
        storyProgressRef={storyProgressRef}
        tier="high"
      />,
    );

    await waitFor(() => {
      expect(storyProgressRef.current.setRenderActivity).toBeTypeOf("function");
    });
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("never");
    expect(fiberMock.invalidate).not.toHaveBeenCalled();

    fiberMock.setFrameloop.mockClear();
    storyProgressRef.current.storyVisible = false;
    act(() => {
      storyProgressRef.current.setRenderActivity?.(false);
    });
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("never");
    expect(fiberMock.invalidate).not.toHaveBeenCalled();

    storyProgressRef.current.storyVisible = true;
    act(() => {
      storyProgressRef.current.setRenderActivity?.(true);
    });
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("always");
    expect(fiberMock.invalidate).toHaveBeenCalledOnce();

    view.unmount();
    expect(storyProgressRef.current.setRenderActivity).toBeUndefined();
  });

  it("allows one context recovery then fails closed on a repeated loss", async () => {
    const onFailure = vi.fn();
    const onRecovering = vi.fn();
    const view = render(
      <ExperienceCanvas
        onFailure={onFailure}
        onReady={vi.fn()}
        onRecovering={onRecovering}
        storyProgressRef={createStoryProgressRef()}
        tier="high"
      />,
    );

    await waitFor(() => expect(fiberMock.gl.domElement).not.toBeNull());
    const canvas = view.container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    const firstLoss = new Event("webglcontextlost", { cancelable: true });
    fireEvent(canvas!, firstLoss);
    expect(firstLoss.defaultPrevented).toBe(true);
    expect(onRecovering).toHaveBeenCalledOnce();
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("never");
    expect(onFailure).not.toHaveBeenCalled();

    const configureCallsBeforeRestore =
      fiberMock.gl.setClearColor.mock.calls.length;
    fireEvent(canvas!, new Event("webglcontextrestored"));
    expect(fiberMock.gl.setClearColor).toHaveBeenCalledTimes(
      configureCallsBeforeRestore + 1,
    );
    expect(fiberMock.setFrameloop).toHaveBeenLastCalledWith("always");
    expect(fiberMock.invalidate).toHaveBeenCalled();

    fireEvent(canvas!, new Event("webglcontextlost", { cancelable: true }));
    expect(onRecovering).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toEqual(
      new Error("WebGL context was lost more than once."),
    );
  });

  it("fails closed when the first context does not recover in time", async () => {
    vi.useFakeTimers();
    const onFailure = vi.fn();
    const view = render(
      <ExperienceCanvas
        onFailure={onFailure}
        onReady={vi.fn()}
        onRecovering={vi.fn()}
        storyProgressRef={createStoryProgressRef()}
        tier="standard"
      />,
    );

    expect(fiberMock.gl.domElement).not.toBeNull();
    const canvas = view.container.querySelector("canvas");
    fireEvent(canvas!, new Event("webglcontextlost", { cancelable: true }));

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toEqual(
      new Error("WebGL context did not recover in time."),
    );
  });
});
