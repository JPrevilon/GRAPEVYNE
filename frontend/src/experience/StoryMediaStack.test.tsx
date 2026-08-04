import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { StrictMode, type MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneProvider } from "./SceneProvider";
import type { SceneProgress } from "./sceneContextValue";
import StoryMediaStack from "./StoryMediaStack";
import {
  getMediaTransition,
  getScrubTime,
} from "./storyMediaMath";
import { useScene } from "./useScene";

const mediaMode = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mediaMode.mobile,
}));
vi.mock("@/hooks/useStoryStaticMode", () => ({
  useStoryStaticMode: () => ({ reason: null, staticMode: false }),
}));

let capturedProgressRef: MutableRefObject<SceneProgress> | undefined;

function ProgressProbe() {
  capturedProgressRef = useScene().progressRef;
  return null;
}

function renderStack({ strict = false } = {}) {
  const content = (
    <SceneProvider>
      <ProgressProbe />
      <StoryMediaStack />
    </SceneProvider>
  );
  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

describe("StoryMediaStack", () => {
  beforeEach(() => {
    capturedProgressRef = undefined;
    mediaMode.mobile = false;
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("maps normalized progress to the safe seekable duration", () => {
    expect(getScrubTime(0, 6)).toBe(0);
    expect(getScrubTime(0.5, 6)).toBeCloseTo(2.98);
    expect(getScrubTime(1, 6)).toBeCloseTo(5.96);
    expect(getScrubTime(2, 6)).toBeCloseTo(5.96);
  });

  it("passes scene transitions through the common base", () => {
    expect(getMediaTransition(0.5)).toMatchObject({
      currentOpacity: 1,
      nextOpacity: 0,
    });
    expect(getMediaTransition(0.86)).toMatchObject({
      currentOpacity: 0,
      nextOpacity: 0,
      veilOpacity: 1,
    });
    const finalTransition = getMediaTransition(1);
    expect(finalTransition.currentOpacity).toBe(0);
    expect(finalTransition.nextOpacity).toBeCloseTo(1);
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
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const view = renderStack();
    const desktopVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );
    expect(desktopVideo).not.toBeNull();

    fireEvent.seeked(desktopVideo!);
    expect(desktopVideo).toHaveClass("is-decoded");

    mediaMode.mobile = true;
    view.rerender(
      <SceneProvider>
        <ProgressProbe />
        <StoryMediaStack />
      </SceneProvider>,
    );
    const mobileVideo = view.container.querySelector<HTMLVideoElement>(
      "[data-scrub-video='hero']",
    );

    expect(mobileVideo).not.toBe(desktopVideo);
    expect(mobileVideo?.querySelector("source")?.getAttribute("src")).toContain(
      ".mobile.",
    );
    expect(mobileVideo).not.toHaveClass("is-decoded");
    fireEvent.canPlay(mobileVideo!);
    expect(mobileVideo).not.toHaveClass("is-decoded");
    fireEvent.seeked(mobileVideo!);
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
    capturedProgressRef.current.storyVisible = true;
    capturedProgressRef.current.chapter = 0.8;
    flushFrame();
    const forwardTime = video?.currentTime ?? 0;
    expect(forwardTime).toBeCloseTo(4.768);

    capturedProgressRef.current.chapter = 0.2;
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
});
