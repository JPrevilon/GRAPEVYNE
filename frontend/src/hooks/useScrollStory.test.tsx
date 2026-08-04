import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type CSSProperties, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sceneMock = vi.hoisted(() => {
  const setRenderActivity = vi.fn();

  return {
    prefersReducedMotion: false,
    progressRef: {
      current: {
        chapter: 0,
        setRenderActivity,
        story: 0,
        storyVisible: false,
      },
    },
    setCurrentChapterId: vi.fn(),
    setHomepageActive: vi.fn(),
    setRenderActivity,
  };
});

vi.mock("@/experience/storyChapters", () => ({
  STORY_CHAPTER_KEYS: [
    "hero",
    "discovery",
    "match",
    "taste",
    "portal",
    "cellar",
    "memory",
    "atlas",
    "finale",
  ],
}));

vi.mock("@/experience/useScene", () => ({
  useScene: () => sceneMock,
}));

import {
  type ScrollRuntimeLoader,
  useScrollStory,
} from "./useScrollStory";

const CHAPTERS = [
  "hero",
  "discovery",
  "match",
  "taste",
  "portal",
  "cellar",
  "memory",
  "atlas",
  "finale",
] as const;

const PINNED_CHAPTERS = new Set(["hero", "match", "portal", "memory", "atlas"]);

class IntersectionObserverMock implements IntersectionObserver {
  static instances: IntersectionObserverMock[] = [];

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
  readonly unobserve = vi.fn();

  constructor(
    readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.rootMargin = options.rootMargin ?? "0px";
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
    IntersectionObserverMock.instances.push(this);
  }
}

interface MediaQueryMock {
  addEventListener: ReturnType<typeof vi.fn>;
  query: string;
  removeEventListener: ReturnType<typeof vi.fn>;
}

let mediaQueries: MediaQueryMock[] = [];
let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;
const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, "fonts");
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);

function installMediaQueries(matches: (query: string) => boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const record: MediaQueryMock = {
      addEventListener: vi.fn(),
      query,
      removeEventListener: vi.fn(),
    };
    mediaQueries.push(record);

    return {
      addEventListener: record.addEventListener,
      addListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
      matches: matches(query),
      media: query,
      onchange: null,
      removeEventListener: record.removeEventListener,
      removeListener: vi.fn(),
    };
  });
}

function StoryHarness({
  coordinated = false,
  loadRuntime,
}: {
  coordinated?: boolean;
  loadRuntime: ScrollRuntimeLoader;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useScrollStory(rootRef, loadRuntime, coordinated);

  return (
    <main
      data-testid="story-root"
      ref={rootRef}
      style={{ "--story-progress": "0.25" } as CSSProperties}
    >
      {coordinated ? (
        <div
          data-story-stage
          style={{ "--story-veil-opacity": "0.25" } as CSSProperties}
        />
      ) : null}
      {CHAPTERS.map((chapter, index) => (
        <section
          data-story-chapter={chapter}
          data-story-pin={PINNED_CHAPTERS.has(chapter) ? "" : undefined}
          id={`chapter-${String(index + 1).padStart(2, "0")}-${chapter}`}
          key={chapter}
        >
          <div className="gv-story-chapter__inner">
            <h2 data-story-reveal>{chapter}</h2>
            {["hero", "taste", "portal", "memory", "atlas"].includes(
              chapter,
            ) ? (
              <div className="gv-story-media" />
            ) : null}
          </div>
        </section>
      ))}
    </main>
  );
}

function getEntry(target: Element): IntersectionObserverEntry {
  const bounds = {
    bottom: 700,
    height: 400,
    left: 0,
    right: 100,
    top: 300,
    width: 100,
    x: 0,
    y: 300,
    toJSON: () => ({}),
  };

  return {
    boundingClientRect: bounds,
    intersectionRatio: 0.5,
    intersectionRect: bounds,
    isIntersecting: true,
    rootBounds: null,
    target,
    time: 0,
  };
}

function createDesktopRuntimeMock() {
  const state = {
    contextRevert: vi.fn(),
    lenisDestroy: vi.fn(),
    lenisOff: vi.fn(),
    lenisOn: vi.fn(),
    lenisRaf: vi.fn(),
    lenisResize: vi.fn(),
    lenisScrollTo: vi.fn(),
    lenisScrollCallback: undefined as (() => void) | undefined,
    lenisStarts: 0,
    matchMediaRevert: vi.fn(),
    registerPlugin: vi.fn(),
    scrollTriggerRefresh: vi.fn(),
    scrollTriggerUpdate: vi.fn(),
    tickerAdd: vi.fn(),
    tickerCallback: undefined as ((time: number) => void) | undefined,
    tickerRemove: vi.fn(),
    tickerSleep: vi.fn(),
    triggers: [] as Array<{
      kill: ReturnType<typeof vi.fn>;
      options: Record<string, unknown>;
      progress: number;
    }>,
  };

  const createTrigger = (options: Record<string, unknown>) => {
    const trigger = {
      kill: vi.fn(),
      options,
      progress: 0,
    };

    state.triggers.push(trigger);
    return trigger;
  };

  const ScrollTrigger = {
    create: vi.fn(createTrigger),
    refresh: state.scrollTriggerRefresh,
    update: state.scrollTriggerUpdate,
  };

  class LenisMock {
    constructor() {
      state.lenisStarts += 1;
    }

    destroy() {
      state.lenisDestroy();
    }

    off(event: string, callback: () => void) {
      state.lenisOff(event, callback);
    }

    on(event: string, callback: () => void) {
      state.lenisScrollCallback = callback;
      state.lenisOn(event, callback);
    }

    raf(time: number) {
      state.lenisRaf(time);
    }

    resize() {
      state.lenisResize();
    }

    scrollTo(
      target: number,
      options: { force: boolean; immediate: boolean },
    ) {
      state.lenisScrollTo(target, options);
    }
  }

  const gsap = {
    context: (setup: () => void) => {
      setup();
      return { revert: state.contextRevert };
    },
    fromTo: (
      _target: Element,
      _from: Record<string, unknown>,
      to: Record<string, unknown>,
    ) => ({
      scrollTrigger: createTrigger(
        to.scrollTrigger as Record<string, unknown>,
      ),
    }),
    matchMedia: () => {
      let matchCleanup: (() => void) | undefined;
      const media = {
        add: (_query: string, setup: () => void | (() => void)) => {
          matchCleanup = setup() ?? undefined;
          return media;
        },
        revert: () => {
          matchCleanup?.();
          matchCleanup = undefined;
          state.matchMediaRevert();
        },
      };

      return media;
    },
    registerPlugin: state.registerPlugin,
    ticker: {
      add: state.tickerAdd.mockImplementation(
        (callback: (time: number) => void) => {
          state.tickerCallback = callback;
        },
      ),
      remove: state.tickerRemove,
      sleep: state.tickerSleep,
    },
  };

  const runtime = {
    gsap,
    Lenis: LenisMock,
    ScrollTrigger,
  };
  const loadRuntimeMock = vi.fn(async () => runtime);

  return {
    loadRuntime: loadRuntimeMock as unknown as ScrollRuntimeLoader,
    loadRuntimeMock,
    runtime,
    state,
  };
}

beforeEach(() => {
  sceneMock.prefersReducedMotion = false;
  sceneMock.progressRef.current = {
    chapter: 0,
    setRenderActivity: sceneMock.setRenderActivity,
    story: 0,
    storyVisible: false,
  };
  sceneMock.setRenderActivity.mockClear();
  sceneMock.setCurrentChapterId.mockClear();
  sceneMock.setHomepageActive.mockClear();
  mediaQueries = [];
  IntersectionObserverMock.instances = [];
  document.documentElement.classList.remove(
    "has-scroll-story",
    "has-scroll-smoothing",
  );

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: IntersectionObserverMock,
    writable: true,
  });

  requestAnimationFrameMock = vi.fn(() => 73);
  cancelAnimationFrameMock = vi.fn();
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  if (originalFontsDescriptor) {
    Object.defineProperty(document, "fonts", originalFontsDescriptor);
  } else {
    Reflect.deleteProperty(document, "fonts");
  }
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      originalScrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  }
});

describe("useScrollStory native runtime", () => {
  it("publishes candidates without competing while the lazy media coordinator is suspended", () => {
    sceneMock.prefersReducedMotion = true;
    installMediaQueries(() => false);
    const loadRuntime = vi.fn() as unknown as ScrollRuntimeLoader;
    const view = render(
      <StoryHarness coordinated loadRuntime={loadRuntime} />,
    );
    const root = screen.getByTestId("story-root");
    expect(root.querySelector("[data-story-media-stack]")).toBeNull();
    const discovery = root.querySelector('[data-story-chapter="discovery"]');
    const observer = IntersectionObserverMock.instances[0];
    expect(discovery).not.toBeNull();
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      ...getEntry(root).boundingClientRect,
      bottom: 900,
      height: 1000,
      top: -100,
      y: -100,
    });
    vi.spyOn(discovery!, "getBoundingClientRect").mockReturnValue(
      getEntry(discovery!).boundingClientRect,
    );

    observer?.callback([getEntry(discovery!)], observer);
    expect(sceneMock.setCurrentChapterId).not.toHaveBeenCalled();
    expect(sceneMock.progressRef.current.story).toBeGreaterThan(0);
    view.unmount();
  });

  it("restores a direct chapter hash and handles later history navigation", () => {
    sceneMock.prefersReducedMotion = true;
    installMediaQueries(() => false);
    window.history.replaceState(null, "", "/#chapter-05-portal");
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const loadRuntime = vi.fn() as unknown as ScrollRuntimeLoader;

    const view = render(<StoryHarness loadRuntime={loadRuntime} />);
    const initialHashFrame = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
    act(() => initialHashFrame?.(performance.now()));

    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "start" });
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("portal");

    window.history.pushState(null, "", "/#chapter-08-atlas");
    fireEvent(window, new Event("hashchange"));
    const historyHashFrame = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
    act(() => historyHashFrame?.(performance.now()));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("atlas");

    window.history.pushState(null, "", "/");
    fireEvent(window, new Event("hashchange"));
    const clearedHashFrame = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
    act(() => clearedHashFrame?.(performance.now()));

    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("hero");
    view.unmount();
  });

  it("closes the actual stage veil before a coordinated direct-hash scroll", () => {
    sceneMock.prefersReducedMotion = true;
    installMediaQueries(() => false);
    window.history.replaceState(null, "", "/#chapter-05-portal");
    const loadRuntime = vi.fn() as unknown as ScrollRuntimeLoader;

    const view = render(
      <StoryHarness coordinated loadRuntime={loadRuntime} />,
    );
    const stage = view.container.querySelector<HTMLElement>(
      "[data-story-stage]",
    );

    expect(stage).not.toBeNull();
    expect(stage?.style.getPropertyValue("--story-veil-opacity")).toBe("1");
    expect(
      view.container.querySelector("[data-story-media-stack]"),
    ).toBeNull();
    expect(sceneMock.progressRef.current).toMatchObject({
      forceBlackGate: true,
      navigationTargetIndex: 4,
    });

    view.unmount();
  });

  it("uses IntersectionObserver in reduced motion without loading animation modules", async () => {
    sceneMock.prefersReducedMotion = true;
    installMediaQueries(() => false);
    const loadRuntimeMock = vi.fn();
    const loadRuntime = loadRuntimeMock as unknown as ScrollRuntimeLoader;

    const view = render(
      <StrictMode>
        <StoryHarness loadRuntime={loadRuntime} />
      </StrictMode>,
    );
    const root = screen.getByTestId("story-root");

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadRuntimeMock).not.toHaveBeenCalled();
    expect(IntersectionObserverMock.instances).toHaveLength(2);
    expect(IntersectionObserverMock.instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(IntersectionObserverMock.instances[1]?.observe).toHaveBeenCalledTimes(9);
    expect(document.documentElement).toHaveClass("has-scroll-story");
    expect(document.documentElement).not.toHaveClass("has-scroll-smoothing");

    const discovery = root.querySelector('[data-story-chapter="discovery"]');
    const activeObserver = IntersectionObserverMock.instances[1];

    expect(discovery).not.toBeNull();
    expect(activeObserver).toBeDefined();
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      ...getEntry(root).boundingClientRect,
      bottom: 900,
      height: 1000,
      top: -100,
      y: -100,
    });
    vi.spyOn(discovery!, "getBoundingClientRect").mockReturnValue(
      getEntry(discovery!).boundingClientRect,
    );
    sceneMock.setRenderActivity.mockClear();
    activeObserver?.callback([getEntry(discovery!)], activeObserver);
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("discovery");
    expect(sceneMock.progressRef.current.chapter).toBeCloseTo(
      (window.innerHeight / 2 - 300) / 400,
    );
    expect(sceneMock.progressRef.current.story).toBeCloseTo(
      100 / Math.max(1000 - window.innerHeight, 1),
    );
    expect(sceneMock.progressRef.current.storyVisible).toBe(true);
    expect(sceneMock.setRenderActivity).toHaveBeenCalledOnce();
    expect(sceneMock.setRenderActivity).toHaveBeenLastCalledWith(true);

    fireEvent.scroll(window);
    expect(requestAnimationFrameMock).toHaveBeenCalledOnce();

    view.unmount();

    expect(activeObserver?.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(73);
    expect(document.documentElement).not.toHaveClass("has-scroll-story");
    expect(root.style.getPropertyValue("--story-progress")).toBe("0.25");
    expect(root.style.getPropertyValue("--chapter-progress")).toBe("");
    expect(sceneMock.progressRef.current).toMatchObject({
      chapter: 0,
      story: 0,
      storyVisible: false,
    });
    expect(sceneMock.setRenderActivity).toHaveBeenLastCalledWith(false);
    expect(sceneMock.setHomepageActive).toHaveBeenLastCalledWith(false);
    mediaQueries.forEach(({ removeEventListener }) => {
      expect(removeEventListener).toHaveBeenCalledOnce();
    });
  });

  it.each([
    ["a viewport at the tablet breakpoint", (query: string) => query.includes("max-width")],
    ["a coarse pointer", (query: string) => query.includes("pointer: coarse")],
  ])("keeps %s native and free of animation imports", async (_label, matches) => {
    installMediaQueries(matches);
    const loadRuntimeMock = vi.fn();
    const loadRuntime = loadRuntimeMock as unknown as ScrollRuntimeLoader;

    const view = render(<StoryHarness loadRuntime={loadRuntime} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadRuntimeMock).not.toHaveBeenCalled();
    expect(IntersectionObserverMock.instances).toHaveLength(1);
    expect(IntersectionObserverMock.instances[0]?.observe).toHaveBeenCalledTimes(9);

    view.unmount();
    expect(IntersectionObserverMock.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });
});

describe("useScrollStory desktop runtime", () => {
  it("re-applies a direct chapter hash through Lenis after startup", async () => {
    installMediaQueries(() => false);
    window.history.replaceState(null, "", "/#chapter-05-portal");
    const { loadRuntime, state } = createDesktopRuntimeMock();

    const view = render(<StoryHarness loadRuntime={loadRuntime} />);
    const initialHashFrame = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
    act(() => initialHashFrame?.(performance.now()));
    await waitFor(() => expect(state.lenisStarts).toBe(1));

    const runtimeHashFrame = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
    act(() => runtimeHashFrame?.(performance.now()));

    expect(state.lenisResize).toHaveBeenCalled();
    expect(state.lenisScrollTo).toHaveBeenCalledWith(expect.any(Number), {
      force: true,
      immediate: true,
    });
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("portal");

    view.unmount();
  });

  it("refreshes measurements once after fonts settle", async () => {
    installMediaQueries(() => false);
    const { loadRuntime, state } = createDesktopRuntimeMock();
    let resolveFonts: () => void = () => undefined;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fontsReady },
    });

    const view = render(<StoryHarness loadRuntime={loadRuntime} />);
    await waitFor(() => expect(state.lenisStarts).toBe(1));
    expect(state.scrollTriggerRefresh).not.toHaveBeenCalled();

    await act(async () => {
      resolveFonts();
      await fontsReady;
    });
    expect(state.scrollTriggerRefresh).toHaveBeenCalledOnce();

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(state.scrollTriggerRefresh).toHaveBeenCalledOnce();
  });

  it("does not refresh or revive the runtime when fonts settle after unmount", async () => {
    installMediaQueries(() => false);
    const { loadRuntime, state } = createDesktopRuntimeMock();
    let resolveFonts: () => void = () => undefined;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fontsReady },
    });

    const view = render(<StoryHarness loadRuntime={loadRuntime} />);
    await waitFor(() => expect(state.lenisStarts).toBe(1));
    expect(state.scrollTriggerRefresh).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => {
      resolveFonts();
      await fontsReady;
      await Promise.resolve();
    });

    expect(state.scrollTriggerRefresh).not.toHaveBeenCalled();
    expect(state.lenisDestroy).toHaveBeenCalledOnce();
  });

  it("sleeps an imported GSAP ticker when unmounted before runtime setup", async () => {
    installMediaQueries(() => false);
    const { runtime, state } = createDesktopRuntimeMock();
    type RuntimeDependencies = Awaited<ReturnType<ScrollRuntimeLoader>>;
    let resolveRuntime: (dependencies: RuntimeDependencies) => void = () =>
      undefined;
    const deferredRuntime = new Promise<RuntimeDependencies>((resolve) => {
      resolveRuntime = resolve;
    });
    const loadRuntime = vi.fn(() => deferredRuntime) as unknown as ScrollRuntimeLoader;
    const view = render(<StoryHarness loadRuntime={loadRuntime} />);

    expect(loadRuntime).toHaveBeenCalledOnce();
    view.unmount();

    await act(async () => {
      resolveRuntime(runtime as unknown as RuntimeDependencies);
      await deferredRuntime;
      await Promise.resolve();
    });

    expect(state.lenisStarts).toBe(0);
    expect(state.tickerSleep).toHaveBeenCalledOnce();
  });

  it("synchronizes Lenis and tears down only its owned work in StrictMode", async () => {
    installMediaQueries(() => false);
    const { loadRuntime, loadRuntimeMock, state } =
      createDesktopRuntimeMock();

    const view = render(
      <StrictMode>
        <StoryHarness loadRuntime={loadRuntime} />
      </StrictMode>,
    );
    const root = screen.getByTestId("story-root");

    await waitFor(() => expect(state.lenisStarts).toBe(1));

    expect(loadRuntimeMock).toHaveBeenCalledTimes(2);
    expect(state.registerPlugin).toHaveBeenCalledOnce();
    expect(state.triggers).toHaveLength(22);
    expect(
      state.triggers.some(
        ({ options }) => options.id === "grapevyne-story-reveal-hero-0",
      ),
    ).toBe(false);
    expect(
      state.triggers.some(({ options }) =>
        String(options.id).startsWith("grapevyne-story-pin-"),
      ),
    ).toBe(false);
    expect(document.documentElement).toHaveClass(
      "has-scroll-story",
      "has-scroll-smoothing",
    );

    state.tickerCallback?.(1.25);
    expect(state.lenisRaf).toHaveBeenCalledWith(1250);

    state.lenisScrollCallback?.();
    expect(state.scrollTriggerUpdate).toHaveBeenCalledOnce();

    const overallTrigger = state.triggers.find(
      ({ options }) => options.id === "grapevyne-story-progress",
    );
    const discoveryTrigger = state.triggers.find(
      ({ options }) =>
        options.id === "grapevyne-story-chapter-discovery",
    );
    const updateOverall = overallTrigger?.options.onUpdate as
      | ((self: { progress: number }) => void)
      | undefined;
    const enterDiscovery = discoveryTrigger?.options.onEnter as
      | ((self: { progress: number }) => void)
      | undefined;
    const enterStoryBack = overallTrigger?.options.onEnterBack as
      | (() => void)
      | undefined;
    const leaveStory = overallTrigger?.options.onLeave as
      | (() => void)
      | undefined;

    sceneMock.setRenderActivity.mockClear();
    leaveStory?.();
    enterStoryBack?.();
    expect(sceneMock.setRenderActivity.mock.calls).toEqual([[false], [true]]);

    updateOverall?.({ progress: 0.4 });
    enterDiscovery?.({ progress: 0.3 });

    expect(root.style.getPropertyValue("--story-progress")).toBe("0.4");
    expect(root.style.getPropertyValue("--chapter-progress")).toBe("0.3");
    expect(sceneMock.progressRef.current).toMatchObject({
      chapter: 0.3,
      story: 0.4,
      storyVisible: true,
    });
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("discovery");

    view.unmount();

    expect(state.tickerRemove).toHaveBeenCalledOnce();
    // Strict Mode abandons its first async setup, then the live setup sleeps
    // the ticker during the explicit unmount.
    expect(state.tickerSleep).toHaveBeenCalledTimes(2);
    expect(state.lenisOff).toHaveBeenCalledOnce();
    expect(state.lenisDestroy).toHaveBeenCalledOnce();
    state.triggers.forEach(({ kill }) => {
      expect(kill).toHaveBeenCalledOnce();
      expect(kill).toHaveBeenCalledWith(true);
    });
    expect(state.matchMediaRevert).toHaveBeenCalledOnce();
    expect(state.contextRevert).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveClass(
      "has-scroll-story",
      "has-scroll-smoothing",
    );
    expect(root.style.getPropertyValue("--story-progress")).toBe("0.25");
    expect(root.style.getPropertyValue("--chapter-progress")).toBe("");
    expect(sceneMock.progressRef.current).toMatchObject({
      chapter: 0,
      story: 0,
      storyVisible: false,
    });
    expect(sceneMock.setRenderActivity).toHaveBeenLastCalledWith(false);
    expect(sceneMock.setHomepageActive).toHaveBeenLastCalledWith(false);
  });
});
