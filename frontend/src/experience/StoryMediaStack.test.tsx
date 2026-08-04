import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { StrictMode, type MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneProvider } from "./SceneProvider";
import type { SceneProgress } from "./sceneContextValue";
import StoryMediaStack from "./StoryMediaStack";
import { getScrubTime } from "./storyMediaMath";
import { useScene } from "./useScene";
import {
  createSubjectInteractionState,
  type InteractiveStorySubject,
  type SubjectInteractionState,
} from "./webgl/subjectInteraction";

const mediaMode = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mediaMode.mobile,
}));
vi.mock("@/hooks/useStoryStaticMode", () => ({
  useStoryStaticMode: () => ({ reason: null, staticMode: false }),
}));

let capturedProgressRef: MutableRefObject<SceneProgress> | undefined;
let setCapturedChapter: ReturnType<typeof useScene>["setCurrentChapterId"] | undefined;

function ProgressProbe() {
  const scene = useScene();
  capturedProgressRef = scene.progressRef;
  setCapturedChapter = scene.setCurrentChapterId;
  return null;
}

function renderStack({
  interactionRef,
  onInteractiveSubjectChange,
  strict = false,
}: {
  interactionRef?: MutableRefObject<SubjectInteractionState>;
  onInteractiveSubjectChange?: (
    subject: InteractiveStorySubject | null,
  ) => void;
  strict?: boolean;
} = {}) {
  const content = (
    <SceneProvider>
      <div className="gv-story">
        <ProgressProbe />
        <StoryMediaStack
          interactionRef={interactionRef}
          onInteractiveSubjectChange={onInteractiveSubjectChange}
        />
      </div>
    </SceneProvider>
  );
  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

function installAnimationFrameQueue() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    nextHandle += 1;
    callbacks.set(nextHandle, callback);
    return nextHandle;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    callbacks.delete(handle);
  });

  return {
    callbacks,
    flush() {
      const entry = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      if (!entry) throw new Error("Expected one scheduled story frame");
      callbacks.delete(entry[0]);
      act(() => entry[1](performance.now()));
    },
  };
}

function prepareVideo(video: HTMLVideoElement, duration = 6) {
  Object.defineProperty(video, "duration", {
    configurable: true,
    value: duration,
  });
  Object.defineProperty(video, "readyState", {
    configurable: true,
    value: 1,
  });
}

describe("StoryMediaStack", () => {
  beforeEach(() => {
    capturedProgressRef = undefined;
    setCapturedChapter = undefined;
    mediaMode.mobile = false;
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("maps normalized progress to the safe seekable duration", () => {
    expect(getScrubTime(0, 6)).toBe(0);
    expect(getScrubTime(0.5, 6)).toBeCloseTo(2.98);
    expect(getScrubTime(1, 6)).toBeCloseTo(5.96);
    expect(getScrubTime(2, 6)).toBeCloseTo(5.96);
  });

  it("prepares only the current and adjacent chapter media without autoplay or loop", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { container, unmount } = renderStack();

    expect(container.querySelectorAll("[data-media-prepared='true']")).toHaveLength(2);
    expect(container.querySelectorAll("video")).toHaveLength(2);
    container.querySelectorAll("video").forEach((video) => {
      expect(video).not.toHaveAttribute("autoplay");
      expect(video).not.toHaveAttribute("loop");
      expect(video).toHaveAttribute("playsinline");
    });

    act(() => unmount());
  });

  it("selects only mobile story sources for a mobile viewport", () => {
    mediaMode.mobile = true;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { container } = renderStack();

    const sources = Array.from(container.querySelectorAll("source")).map(
      (source) => source.getAttribute("src"),
    );
    expect(sources).toHaveLength(4);
    expect(sources.every((source) => source?.includes(".mobile."))).toBe(true);
    expect(sources.some((source) => source?.includes(".desktop."))).toBe(false);
  });

  it("replaces the video and waits for the sought frame when its device source changes", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextHandle += 1;
      callbacks.set(nextHandle, callback);
      return nextHandle;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
      callbacks.delete(handle);
    });
    const flushFrame = () => {
      const entry = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      if (!entry) throw new Error("Expected one scheduled story frame");
      callbacks.delete(entry[0]);
      act(() => entry[1](performance.now()));
    };
    const view = renderStack();
    const desktopVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(desktopVideo).not.toBeNull();

    Object.defineProperty(desktopVideo, "duration", { configurable: true, value: 6 });
    Object.defineProperty(desktopVideo, "readyState", { configurable: true, value: 1 });
    if (capturedProgressRef) {
      capturedProgressRef.current.forceBlackGate = false;
      capturedProgressRef.current.storyVisible = true;
    }
    flushFrame();

    fireEvent.seeked(desktopVideo!);
    expect(desktopVideo).toHaveClass("is-decoded");

    mediaMode.mobile = true;
    view.rerender(
      <SceneProvider>
        <div className="gv-story">
          <ProgressProbe />
          <StoryMediaStack />
        </div>
      </SceneProvider>,
    );
    const mobileVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );

    expect(mobileVideo).not.toBe(desktopVideo);
    expect(mobileVideo?.querySelector("source")?.getAttribute("src")).toContain(
      ".mobile.",
    );
    expect(capturedProgressRef?.current.forceBlackGate).toBe(true);
    expect(capturedProgressRef?.current.navigationTargetIndex).toBe(0);
    expect(
      view.container
        .querySelector<HTMLElement>(".gv-story")
        ?.style.getPropertyValue("--story-veil-opacity"),
    ).toBe("1");
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toHaveAttribute("data-active-media", "black");
    expect(mobileVideo).not.toHaveClass("is-decoded");
    Object.defineProperty(mobileVideo, "duration", { configurable: true, value: 6 });
    Object.defineProperty(mobileVideo, "readyState", { configurable: true, value: 1 });
    flushFrame();
    fireEvent.canPlay(mobileVideo!);
    expect(mobileVideo).toHaveClass("is-decoded");
  });

  it("seeks directly forward and backward and pauses on route teardown", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextHandle += 1;
      callbacks.set(nextHandle, callback);
      return nextHandle;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
      callbacks.delete(handle);
    });
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    const { container, unmount } = renderStack();
    const video = container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    Object.defineProperty(video, "duration", { configurable: true, value: 6 });
    Object.defineProperty(video, "readyState", { configurable: true, value: 1 });

    const flushFrame = () => {
      const entry = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      if (!entry) throw new Error("Expected one scheduled story frame");
      callbacks.delete(entry[0]);
      act(() => entry[1](performance.now()));
    };

    expect(capturedProgressRef).toBeDefined();
    if (!capturedProgressRef) return;
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;
    capturedProgressRef.current.chapter = 0.8;
    capturedProgressRef.current.story = 0.1;
    flushFrame();
    const forwardTime = video?.currentTime ?? 0;
    expect(forwardTime).toBeCloseTo(4.768);

    capturedProgressRef.current.chapter = 0.2;
    capturedProgressRef.current.story = 0.025;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    flushFrame();
    expect(video?.currentTime).toBeCloseTo(1.192);
    expect(video?.currentTime).toBeLessThan(forwardTime);

    act(() => unmount());
    expect(pause).toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });

  it("owns at most one pending story frame through StrictMode replay", () => {
    const callbacks = new Set<number>();
    let nextHandle = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
      nextHandle += 1;
      callbacks.add(nextHandle);
      return nextHandle;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
      callbacks.delete(handle);
    });

    renderStack({ strict: true });
    expect(callbacks.size).toBe(1);
  });

  it("uses exact requestVideoFrameCallback metadata and cancels superseded and unmounted requests", () => {
    const frameQueue = installAnimationFrameQueue();
    const frameCallbacks = new Map<number, VideoFrameRequestCallback>();
    let nextFrameHandle = 100;
    const requestVideoFrameCallback = vi.fn(
      (callback: VideoFrameRequestCallback) => {
        nextFrameHandle += 1;
        frameCallbacks.set(nextFrameHandle, callback);
        return nextFrameHandle;
      },
    );
    const cancelVideoFrameCallback = vi.fn((handle: number) => {
      frameCallbacks.delete(handle);
    });
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    if (!video || !capturedProgressRef) return;
    prepareVideo(video);
    Object.defineProperties(video, {
      cancelVideoFrameCallback: {
        configurable: true,
        value: cancelVideoFrameCallback,
      },
      requestVideoFrameCallback: {
        configurable: true,
        value: requestVideoFrameCallback,
      },
    });
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    frameQueue.flush();
    const firstHandle = nextFrameHandle;
    const firstCallback = frameCallbacks.get(firstHandle);
    expect(firstCallback).toBeDefined();
    expect(video).toHaveAttribute("data-pending-seek", "true");
    expect(video).not.toHaveClass("is-decoded");

    capturedProgressRef.current.story = 0.05;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    const secondHandle = nextFrameHandle;
    const secondCallback = frameCallbacks.get(secondHandle);
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(firstHandle);
    expect(secondHandle).not.toBe(firstHandle);
    expect(secondCallback).toBeDefined();

    firstCallback?.(performance.now(), {
      mediaTime: 0,
    } as VideoFrameCallbackMetadata);
    expect(video).not.toHaveClass("is-decoded");
    expect(video).toHaveAttribute("data-pending-seek", "true");

    const exactTarget = Number(video.dataset.targetTime);
    secondCallback?.(performance.now(), {
      mediaTime: exactTarget,
    } as VideoFrameCallbackMetadata);
    expect(video).toHaveClass("is-decoded");
    expect(video).toHaveAttribute("data-decoded-frame-ready", "true");
    expect(video).toHaveAttribute("data-readiness-kind", "decoded-exact");

    capturedProgressRef.current.story = 0.08;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    const finalHandle = nextFrameHandle;
    view.unmount();
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(finalHandle);
  });

  it("skips sub-half-frame writes and retains the displayed frame during a meaningful seek", () => {
    const frameQueue = installAnimationFrameQueue();
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    if (!video || !capturedProgressRef) return;
    let assignedTime = 0;
    let currentTimeWrites = 0;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => assignedTime,
      set: (value: number) => {
        assignedTime = value;
        currentTimeWrites += 1;
      },
    });
    prepareVideo(video);
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    frameQueue.flush();
    expect(currentTimeWrites).toBe(1);
    fireEvent.seeked(video);
    expect(video).toHaveClass("is-decoded");
    frameQueue.flush();
    expect(view.container.querySelector(".gv-story")).toHaveStyle(
      "--story-copy-opacity: 1",
    );

    capturedProgressRef.current.story = 0.0002;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(currentTimeWrites).toBe(1);

    capturedProgressRef.current.story = 0.01;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(currentTimeWrites).toBe(2);
    expect(video).toHaveClass("is-decoded");
    expect(video).toHaveAttribute(
      "data-readiness-kind",
      "displayed-frame-pending-exact",
    );

    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(
      view.container.querySelector("[data-media-chapter='hero']"),
    ).toHaveAttribute("data-frame-ready", "true");
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toHaveAttribute("data-active-media", "hero");
  });

  it("retains the upper owner's displayed frame while reversing through a boundary", () => {
    const frameQueue = installAnimationFrameQueue();
    const view = renderStack();
    const heroVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    const discoveryVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='discovery']",
    );
    expect(heroVideo).not.toBeNull();
    expect(discoveryVideo).not.toBeNull();
    if (!heroVideo || !discoveryVideo || !capturedProgressRef) return;
    prepareVideo(heroVideo);
    prepareVideo(discoveryVideo);
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    frameQueue.flush();
    fireEvent.seeked(heroVideo);
    frameQueue.flush();

    capturedProgressRef.current.story = 0.13;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    fireEvent.seeked(discoveryVideo);
    frameQueue.flush();
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toHaveAttribute("data-active-media", "discovery");

    // Re-enter boundary 01 from its upper side at 80% transition progress.
    // The seek target changes, but the last displayed discovery frame remains
    // eligible until the exact replacement frame is decoded.
    capturedProgressRef.current.story = 0.1175;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(discoveryVideo).toHaveAttribute("data-pending-seek", "true");
    expect(discoveryVideo).toHaveAttribute(
      "data-readiness-kind",
      "displayed-frame-pending-exact",
    );
    expect(discoveryVideo).toHaveClass("is-decoded");

    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(
      view.container.querySelector("[data-media-chapter='discovery']"),
    ).toHaveAttribute("data-frame-ready", "true");
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toHaveAttribute("data-active-media", "discovery");
  });

  it("keeps forced-black navigation closed for a stale retained displayed frame", () => {
    const frameQueue = installAnimationFrameQueue();
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    if (!video || !capturedProgressRef) return;
    prepareVideo(video);
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    frameQueue.flush();
    fireEvent.seeked(video);
    frameQueue.flush();

    capturedProgressRef.current.story = 0.01;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(video).toHaveClass("is-decoded");
    expect(video).toHaveAttribute("data-pending-seek", "true");
    expect(video).toHaveAttribute(
      "data-readiness-kind",
      "displayed-frame-pending-exact",
    );

    capturedProgressRef.current.forceBlackGate = true;
    capturedProgressRef.current.navigationTargetIndex = 0;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();

    expect(capturedProgressRef.current.forceBlackGate).toBe(true);
    expect(capturedProgressRef.current.navigationTargetIndex).toBe(0);
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toHaveAttribute("data-active-media", "black");
  });

  it("replaces a retained stale frame with the approved poster after the bounded wait", () => {
    vi.useFakeTimers();
    const frameQueue = installAnimationFrameQueue();
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    const poster = view.container.querySelector<HTMLImageElement>(
      "[data-media-chapter='hero'] .gv-story-media-poster",
    );
    expect(video).not.toBeNull();
    expect(poster).not.toBeNull();
    if (!video || !poster || !capturedProgressRef) return;
    prepareVideo(video);
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    fireEvent.load(poster);
    frameQueue.flush();
    fireEvent.seeked(video);
    frameQueue.flush();
    expect(video).toHaveClass("is-decoded");

    capturedProgressRef.current.story = 0.01;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    expect(video).toHaveClass("is-decoded");
    expect(video).toHaveAttribute(
      "data-readiness-kind",
      "displayed-frame-pending-exact",
    );

    act(() => vi.advanceTimersByTime(1_200));

    expect(video).not.toHaveClass("is-decoded");
    expect(video).toHaveAttribute(
      "data-readiness-kind",
      "approved-poster-fallback",
    );
    expect(video).toHaveAttribute("data-pending-seek", "false");
  });

  it("accepts decoded metadata within one frame and rejects metadata beyond it", () => {
    const frameQueue = installAnimationFrameQueue();
    const frameCallbacks = new Map<number, VideoFrameRequestCallback>();
    let nextFrameHandle = 300;
    const requestVideoFrameCallback = vi.fn(
      (callback: VideoFrameRequestCallback) => {
        nextFrameHandle += 1;
        frameCallbacks.set(nextFrameHandle, callback);
        return nextFrameHandle;
      },
    );
    const cancelVideoFrameCallback = vi.fn((handle: number) => {
      frameCallbacks.delete(handle);
    });
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    if (!video || !capturedProgressRef) return;
    prepareVideo(video);
    Object.defineProperties(video, {
      cancelVideoFrameCallback: {
        configurable: true,
        value: cancelVideoFrameCallback,
      },
      requestVideoFrameCallback: {
        configurable: true,
        value: requestVideoFrameCallback,
      },
    });
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    frameQueue.flush();
    const firstHandle = nextFrameHandle;
    const firstCallback = frameCallbacks.get(firstHandle);
    frameCallbacks.delete(firstHandle);
    const firstTarget = Number(video.dataset.targetTime);
    firstCallback?.(performance.now(), {
      mediaTime: firstTarget + 1 / 24,
    } as VideoFrameCallbackMetadata);
    expect(video).toHaveAttribute("data-readiness-kind", "decoded-exact");
    expect(video).toHaveAttribute("data-pending-seek", "false");

    capturedProgressRef.current.story = 0.01;
    act(() => capturedProgressRef?.current.requestStoryFrame?.());
    frameQueue.flush();
    const secondHandle = nextFrameHandle;
    const secondCallback = frameCallbacks.get(secondHandle);
    frameCallbacks.delete(secondHandle);
    const secondTarget = Number(video.dataset.targetTime);
    secondCallback?.(performance.now(), {
      mediaTime: secondTarget + 1 / 24 + 0.001,
    } as VideoFrameCallbackMetadata);
    expect(video).toHaveAttribute("data-decoded-frame-ready", "false");
    expect(video).toHaveAttribute("data-pending-seek", "true");

    expect(nextFrameHandle).toBeGreaterThan(secondHandle);
    const rearmedHandle = nextFrameHandle;
    const rearmedCallback = frameCallbacks.get(rearmedHandle);
    frameCallbacks.delete(rearmedHandle);
    rearmedCallback?.(performance.now(), {
      mediaTime: secondTarget,
    } as VideoFrameCallbackMetadata);
    expect(video).toHaveAttribute("data-readiness-kind", "decoded-exact");
    expect(video).toHaveAttribute("data-pending-seek", "false");
  });

  it("re-arms an unchanged decoded-frame request after document visibility returns", () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    const frameQueue = installAnimationFrameQueue();
    const requestVideoFrameCallback = vi.fn(
      (_callback: VideoFrameRequestCallback) =>
        requestVideoFrameCallback.mock.calls.length + 200,
    );
    const cancelVideoFrameCallback = vi.fn();
    const view = renderStack();
    const video = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(video).not.toBeNull();
    if (!video || !capturedProgressRef) return;
    prepareVideo(video);
    Object.defineProperties(video, {
      cancelVideoFrameCallback: {
        configurable: true,
        value: cancelVideoFrameCallback,
      },
      requestVideoFrameCallback: {
        configurable: true,
        value: requestVideoFrameCallback,
      },
    });
    capturedProgressRef.current.forceBlackGate = false;
    capturedProgressRef.current.storyVisible = true;

    try {
      frameQueue.flush();
      expect(requestVideoFrameCallback).toHaveBeenCalledTimes(1);
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      fireEvent(document, new Event("visibilitychange"));
      expect(cancelVideoFrameCallback).toHaveBeenCalledOnce();

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      fireEvent(document, new Event("visibilitychange"));
      frameQueue.flush();
      expect(requestVideoFrameCallback).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      }
    }
  });

  it.each(["transition", "offscreen"] as const)(
    "synchronously cancels the active semantic control on %s",
    (mode) => {
      const frameQueue = installAnimationFrameQueue();
      const interactionRef: MutableRefObject<SubjectInteractionState> = {
        current: createSubjectInteractionState(),
      };
      const onSubjectChange = vi.fn();
      const view = renderStack({
        interactionRef,
        onInteractiveSubjectChange: onSubjectChange,
      });
      const video = view.container.querySelector<HTMLVideoElement>(
        "[data-scrub-video='hero']",
      );
      expect(video).not.toBeNull();
      if (!video || !capturedProgressRef) return;
      prepareVideo(video);
      capturedProgressRef.current.forceBlackGate = false;
      capturedProgressRef.current.storyVisible = true;
      frameQueue.flush();
      fireEvent.seeked(video);
      frameQueue.flush();
      expect(onSubjectChange).toHaveBeenLastCalledWith("bottle");

      const element = document.createElement("button");
      const cancel = vi.fn();
      interactionRef.current.control = {
        cancel,
        element,
        subject: "bottle",
      };
      if (mode === "transition") {
        capturedProgressRef.current.story = 0.09;
      } else {
        capturedProgressRef.current.storyVisible = false;
      }
      act(() => capturedProgressRef?.current.requestStoryFrame?.());
      frameQueue.flush();

      expect(cancel).toHaveBeenCalledOnce();
      expect(element.disabled).toBe(true);
      expect(element.style.pointerEvents).toBe("none");
      expect(element).toHaveAttribute("data-transition-disabled", "true");
      expect(onSubjectChange).toHaveBeenLastCalledWith(null);
    },
  );

  it("prepares three middle chapters and only two terminal chapters", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const view = renderStack();

    act(() => setCapturedChapter?.("portal"));
    expect(
      Array.from(
        view.container.querySelectorAll("[data-media-prepared='true']"),
      ).map((layer) => layer.getAttribute("data-media-chapter")),
    ).toEqual(["taste", "portal", "cellar"]);

    act(() => setCapturedChapter?.("finale"));
    expect(
      Array.from(
        view.container.querySelectorAll("[data-media-prepared='true']"),
      ).map((layer) => layer.getAttribute("data-media-chapter")),
    ).toEqual(["atlas", "finale"]);
  });
});
