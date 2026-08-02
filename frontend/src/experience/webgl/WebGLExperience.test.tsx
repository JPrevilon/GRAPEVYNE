import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sceneMock = vi.hoisted(() => ({
  homepageActive: false,
  prefersReducedMotion: false,
  progressRef: {
    current: { chapter: 0, story: 0, storyVisible: true },
  },
}));

const capabilityMock = vi.hoisted(() => ({
  inspect: vi.fn(),
}));

const canvasMock = vi.hoisted(() => ({
  moduleLoads: 0,
  renders: vi.fn(),
  shouldThrow: false,
}));

vi.mock("@/experience/useScene", () => ({
  useScene: () => sceneMock,
}));

vi.mock("./qualityTier", () => ({
  inspectBrowserWebGLCapability: capabilityMock.inspect,
}));

vi.mock("./ExperienceCanvas", async () => {
  const { createElement } = await import("react");
  canvasMock.moduleLoads += 1;

  return {
    default: (props: {
      onFailure: (error: unknown) => void;
      onReady: () => void;
      onRecovering: () => void;
      storyProgressRef: typeof sceneMock.progressRef;
      tier: "high" | "standard";
    }) => {
      canvasMock.renders(props.tier, props.storyProgressRef);

      if (canvasMock.shouldThrow) {
        throw new Error("mock model load failed");
      }

      return createElement(
        "div",
        { "data-testid": "mock-experience-canvas" },
        createElement("canvas", {
          "aria-hidden": "true",
          "data-tier": props.tier,
          style: { pointerEvents: "none" },
          tabIndex: -1,
        }),
        createElement(
          "button",
          { onClick: props.onReady, type: "button" },
          "render first frame",
        ),
        createElement(
          "button",
          { onClick: props.onRecovering, type: "button" },
          "lose context",
        ),
        createElement(
          "button",
          {
            onClick: () => props.onFailure(new Error("mock renderer failed")),
            type: "button",
          },
          "fail renderer",
        ),
      );
    },
  };
});

import WebGLExperience from "./WebGLExperience";

function ReadinessHarness({
  onTransition,
}: {
  onTransition: (ready: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const handleReadyChange = useCallback(
    (nextReady: boolean) => {
      onTransition(nextReady);
      setReady(nextReady);
    },
    [onTransition],
  );

  return (
    <div
      className={ready ? "webgl-ready" : "css-fallback-ready"}
      data-testid="readiness-host"
    >
      <WebGLExperience onReadyChange={handleReadyChange} />
    </div>
  );
}

let animationFrameCallback: FrameRequestCallback | undefined;
let idleCallback: (() => void) | undefined;
let cancelIdleCallbackMock: ReturnType<typeof vi.fn>;
let requestIdleCallbackMock: ReturnType<typeof vi.fn>;

async function activateLazyCanvas() {
  await waitFor(() => expect(window.requestAnimationFrame).toHaveBeenCalled());

  act(() => {
    animationFrameCallback?.(0);
  });
  expect(requestIdleCallbackMock).toHaveBeenCalledOnce();

  await act(async () => {
    idleCallback?.();
    await Promise.resolve();
  });

  return screen.findByTestId("mock-experience-canvas");
}

describe("WebGLExperience lazy shell", () => {
  beforeEach(() => {
    sceneMock.homepageActive = false;
    sceneMock.prefersReducedMotion = false;
    sceneMock.progressRef.current = {
      chapter: 0,
      story: 0,
      storyVisible: true,
    };
    capabilityMock.inspect.mockReset();
    capabilityMock.inspect.mockReturnValue({ reason: null, tier: "high" });
    canvasMock.renders.mockClear();
    canvasMock.shouldThrow = false;
    animationFrameCallback = undefined;
    idleCallback = undefined;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallback = callback;
      return 41;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    requestIdleCallbackMock = vi.fn((callback: () => void) => {
      idleCallback = callback;
      return 57;
    });
    cancelIdleCallbackMock = vi.fn();
    Object.defineProperties(window, {
      cancelIdleCallback: {
        configurable: true,
        value: cancelIdleCallbackMock,
      },
      requestIdleCallback: {
        configurable: true,
        value: requestIdleCallbackMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "cancelIdleCallback");
    Reflect.deleteProperty(window, "requestIdleCallback");
  });

  it("does not schedule or import the renderer off Home or for a fallback decision", async () => {
    const onReadyChange = vi.fn();
    const view = render(<WebGLExperience onReadyChange={onReadyChange} />);

    expect(capabilityMock.inspect).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(canvasMock.moduleLoads).toBe(0);
    expect(document.querySelector("canvas")).not.toBeInTheDocument();

    sceneMock.homepageActive = true;
    sceneMock.prefersReducedMotion = true;
    capabilityMock.inspect.mockReturnValue({
      reason: "reduced-motion",
      tier: "fallback",
    });
    view.rerender(<WebGLExperience onReadyChange={onReadyChange} />);

    await waitFor(() => {
      expect(capabilityMock.inspect).toHaveBeenCalledWith(true);
    });
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(canvasMock.moduleLoads).toBe(0);
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });

  it("defers one inert canvas and promotes it only after the rendered-frame handshake", async () => {
    sceneMock.homepageActive = true;
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const onReadyChange = vi.fn();
    render(<WebGLExperience onReadyChange={onReadyChange} />);

    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    await activateLazyCanvas();

    const layer = document.querySelector<HTMLElement>(".gv-webgl-experience");
    const canvas = document.querySelector("canvas");

    expect(canvasMock.moduleLoads).toBe(1);
    expect(canvasMock.renders).toHaveBeenLastCalledWith(
      "high",
      sceneMock.progressRef,
    );
    expect(document.querySelectorAll("canvas")).toHaveLength(1);
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveAttribute("tabindex", "-1");
    expect(canvas).toHaveStyle({ pointerEvents: "none" });
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveAttribute("data-webgl-status", "loading");
    expect(layer).toHaveAttribute("data-webgl-tier", "high");
    expect((layer as HTMLElement & { inert?: boolean }).inert).toBe(true);
    expect(onReadyChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(
      screen.getByRole("button", {
        hidden: true,
        name: "render first frame",
      }),
    );
    expect(layer).toHaveAttribute("data-webgl-status", "ready");
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "lose context" }),
    );
    expect(layer).toHaveAttribute("data-webgl-status", "recovering");
    expect(onReadyChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(
      screen.getByRole("button", {
        hidden: true,
        name: "render first frame",
      }),
    );
    expect(layer).toHaveAttribute("data-webgl-status", "ready");
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "fail renderer" }),
    );
    expect(document.querySelector(".gv-webgl-experience")).not.toBeInTheDocument();
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expect(consoleWarn).toHaveBeenCalledWith(
      "[GRAPEVYNE WebGL] CSS fallback restored: mock renderer failed",
    );
  });

  it("returns to the CSS fallback when the lazy renderer throws", async () => {
    sceneMock.homepageActive = true;
    canvasMock.shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const onReadyChange = vi.fn();
    render(<WebGLExperience onReadyChange={onReadyChange} />);

    await waitFor(() => expect(window.requestAnimationFrame).toHaveBeenCalled());
    act(() => {
      animationFrameCallback?.(0);
    });
    await act(async () => {
      idleCallback?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(document.querySelector(".gv-webgl-experience")).not.toBeInTheDocument();
    });
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expect(consoleError).toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      "[GRAPEVYNE WebGL] CSS fallback restored: mock model load failed",
    );
  });

  it("restores parent CSS readiness synchronously when a ready renderer fails", async () => {
    sceneMock.homepageActive = true;
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const onTransition = vi.fn();
    render(<ReadinessHarness onTransition={onTransition} />);

    await activateLazyCanvas();
    const host = screen.getByTestId("readiness-host");

    expect(host).toHaveClass("css-fallback-ready");
    fireEvent.click(
      screen.getByRole("button", {
        hidden: true,
        name: "render first frame",
      }),
    );
    expect(host).toHaveClass("webgl-ready");

    onTransition.mockClear();
    let failureClickReturned = false;
    let fallbackCallbackWasSynchronous = false;
    onTransition.mockImplementation((ready) => {
      if (!ready) fallbackCallbackWasSynchronous = !failureClickReturned;
    });

    fireEvent.click(
      screen.getByRole("button", { hidden: true, name: "fail renderer" }),
    );
    failureClickReturned = true;

    expect(fallbackCallbackWasSynchronous).toBe(true);
    expect(onTransition).toHaveBeenCalledOnce();
    expect(onTransition).toHaveBeenCalledWith(false);
    expect(host).toHaveClass("css-fallback-ready");
    expect(host).not.toHaveClass("webgl-ready");
    expect(document.querySelector(".gv-webgl-experience")).not.toBeInTheDocument();
    expect(consoleWarn).toHaveBeenCalledWith(
      "[GRAPEVYNE WebGL] CSS fallback restored: mock renderer failed",
    );
  });

  it("cancels deferred activation callbacks when Home unmounts", async () => {
    sceneMock.homepageActive = true;
    const firstView = render(
      <WebGLExperience onReadyChange={vi.fn()} />,
    );

    await waitFor(() => expect(window.requestAnimationFrame).toHaveBeenCalled());
    firstView.unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(41);
    expect(canvasMock.renders).not.toHaveBeenCalled();

    vi.mocked(window.requestAnimationFrame).mockClear();
    const secondView = render(
      <WebGLExperience onReadyChange={vi.fn()} />,
    );
    await waitFor(() => expect(window.requestAnimationFrame).toHaveBeenCalled());
    act(() => {
      animationFrameCallback?.(0);
    });
    expect(requestIdleCallbackMock).toHaveBeenCalled();

    secondView.unmount();
    expect(cancelIdleCallbackMock).toHaveBeenCalledWith(57);
    expect(canvasMock.renders).not.toHaveBeenCalled();
  });
});
