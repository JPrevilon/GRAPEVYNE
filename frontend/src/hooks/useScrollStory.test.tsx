import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type CSSProperties, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sceneMock = vi.hoisted(() => ({
  prefersReducedMotion: false,
  setCurrentChapterId: vi.fn(),
  setHomepageActive: vi.fn(),
}));

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
  loadRuntime,
}: {
  loadRuntime: ScrollRuntimeLoader;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useScrollStory(rootRef, loadRuntime);

  return (
    <main
      data-testid="story-root"
      ref={rootRef}
      style={{ "--story-progress": "0.25" } as CSSProperties}
    >
      {CHAPTERS.map((chapter) => (
        <section
          data-story-chapter={chapter}
          data-story-pin={PINNED_CHAPTERS.has(chapter) ? "" : undefined}
          key={chapter}
        >
          <h2 data-story-reveal>{chapter}</h2>
          {["hero", "taste", "portal", "memory", "atlas"].includes(
            chapter,
          ) ? (
            <div className="gv-story-media" />
          ) : null}
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
  if (originalFontsDescriptor) {
    Object.defineProperty(document, "fonts", originalFontsDescriptor);
  } else {
    Reflect.deleteProperty(document, "fonts");
  }
});

describe("useScrollStory native runtime", () => {
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
    activeObserver?.callback([getEntry(discovery!)], activeObserver);
    expect(sceneMock.setCurrentChapterId).toHaveBeenLastCalledWith("discovery");

    fireEvent.scroll(window);
    expect(requestAnimationFrameMock).toHaveBeenCalledOnce();

    view.unmount();

    expect(activeObserver?.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(73);
    expect(document.documentElement).not.toHaveClass("has-scroll-story");
    expect(root.style.getPropertyValue("--story-progress")).toBe("0.25");
    expect(root.style.getPropertyValue("--chapter-progress")).toBe("");
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
    expect(state.triggers).toHaveLength(27);
    expect(
      state.triggers.some(
        ({ options }) => options.id === "grapevyne-story-reveal-hero-0",
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

    updateOverall?.({ progress: 0.4 });
    enterDiscovery?.({ progress: 0.3 });

    expect(root.style.getPropertyValue("--story-progress")).toBe("0.4");
    expect(root.style.getPropertyValue("--chapter-progress")).toBe("0.3");
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
    expect(sceneMock.setHomepageActive).toHaveBeenLastCalledWith(false);
  });
});
