import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CinematicVideo, { type CinematicVideoProps } from "./CinematicVideo";
import { CINEMATIC_MEDIA, type MediaKey } from "./media";

const MOBILE_QUERY = "(max-width: 720px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LOAD_ROOT_MARGIN = "320px 0px";
const PLAY_ROOT_MARGIN = "0px";

const expectedRegistryPaths: Record<MediaKey, readonly string[]> = {
  hero: [
    "/assets/video/desktop/hero-bottle-macro.desktop.webm",
    "/assets/video/desktop/hero-bottle-macro.desktop.mp4",
    "/assets/video/posters/desktop/hero-bottle-macro.desktop.jpg",
    "/assets/video/mobile/hero-bottle-macro.mobile.webm",
    "/assets/video/mobile/hero-bottle-macro.mobile.mp4",
    "/assets/video/posters/mobile/hero-bottle-macro.mobile.jpg",
  ],
  liquid: [
    "/assets/video/desktop/taste-liquid-transition.desktop.webm",
    "/assets/video/desktop/taste-liquid-transition.desktop.mp4",
    "/assets/video/posters/desktop/taste-liquid-transition.desktop.jpg",
    "/assets/video/mobile/taste-liquid-transition.mobile.webm",
    "/assets/video/mobile/taste-liquid-transition.mobile.mp4",
    "/assets/video/posters/mobile/taste-liquid-transition.mobile.jpg",
  ],
  cellar: [
    "/assets/video/desktop/cellar-corridor-push.desktop.webm",
    "/assets/video/desktop/cellar-corridor-push.desktop.mp4",
    "/assets/video/posters/desktop/cellar-corridor-push.desktop.jpg",
    "/assets/video/mobile/cellar-corridor-push.mobile.webm",
    "/assets/video/mobile/cellar-corridor-push.mobile.mp4",
    "/assets/video/posters/mobile/cellar-corridor-push.mobile.jpg",
  ],
  memory: [
    "/assets/video/desktop/memory-table-ambience.desktop.webm",
    "/assets/video/desktop/memory-table-ambience.desktop.mp4",
    "/assets/video/posters/desktop/memory-table-ambience.desktop.jpg",
    "/assets/video/mobile/memory-table-ambience.mobile.webm",
    "/assets/video/mobile/memory-table-ambience.mobile.mp4",
    "/assets/video/posters/mobile/memory-table-ambience.mobile.jpg",
  ],
  atlas: [
    "/assets/video/desktop/taste-atlas-finale.desktop.webm",
    "/assets/video/desktop/taste-atlas-finale.desktop.mp4",
    "/assets/video/posters/desktop/taste-atlas-finale.desktop.jpg",
    "/assets/video/mobile/taste-atlas-finale.mobile.webm",
    "/assets/video/mobile/taste-atlas-finale.mobile.mp4",
    "/assets/video/posters/mobile/taste-atlas-finale.mobile.jpg",
  ],
};

interface ControlledMediaQuery {
  listeners: Set<(event: MediaQueryListEvent) => void>;
  mediaQuery: MediaQueryList;
  setMatches: (matches: boolean) => void;
}

function createMatchMediaController(initialMatches: Record<string, boolean>) {
  const queries = new Map<string, ControlledMediaQuery>();

  const matchMedia = vi.fn((query: string) => {
    const existingQuery = queries.get(query);

    if (existingQuery) {
      return existingQuery.mediaQuery;
    }

    let matches = initialMatches[query] ?? false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      addEventListener: vi.fn(
        (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
      ),
      addListener: vi.fn(
        (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
      ),
      dispatchEvent: vi.fn(() => true),
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      removeEventListener: vi.fn(
        (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
      ),
      removeListener: vi.fn(
        (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
      ),
    } as MediaQueryList;
    const controlledQuery: ControlledMediaQuery = {
      listeners,
      mediaQuery,
      setMatches(nextMatches) {
        matches = nextMatches;
        const event = { matches, media: query } as MediaQueryListEvent;
        listeners.forEach((listener) => listener(event));
      },
    };
    queries.set(query, controlledQuery);

    return mediaQuery;
  });

  return {
    get(query: string) {
      const controlledQuery = queries.get(query);

      if (!controlledQuery) {
        throw new Error(`Media query was not initialized: ${query}`);
      }

      return controlledQuery;
    },
    matchMedia,
  };
}

class IntersectionObserverMock implements IntersectionObserver {
  static instances: IntersectionObserverMock[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly callback: IntersectionObserverCallback;
  readonly targets = new Set<Element>();
  disconnected = false;

  disconnect = vi.fn(() => {
    this.disconnected = true;
    this.targets.clear();
  });

  observe = vi.fn((target: Element) => {
    this.targets.add(target);
  });

  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);

  unobserve = vi.fn((target: Element) => {
    this.targets.delete(target);
  });

  constructor(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.callback = callback;
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? "0px";
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
    IntersectionObserverMock.instances.push(this);
  }

  emit({
    intersectionRatio,
    isIntersecting,
    target,
  }: {
    intersectionRatio: number;
    isIntersecting: boolean;
    target?: Element;
  }) {
    const observedTarget = target ?? this.targets.values().next().value;

    if (!observedTarget) {
      throw new Error("The observer has no target.");
    }

    this.callback(
      [
        {
          intersectionRatio,
          isIntersecting,
          target: observedTarget,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  }
}

function getActiveObserver(rootMargin: string) {
  const observer = IntersectionObserverMock.instances
    .slice()
    .reverse()
    .find(
      (candidate) =>
        candidate.rootMargin === rootMargin && !candidate.disconnected,
    );

  if (!observer) {
    throw new Error(`No active observer with root margin ${rootMargin}.`);
  }

  return observer;
}

function getSourcePaths(container: HTMLElement) {
  return Array.from(container.querySelectorAll("source"), (source) =>
    source.getAttribute("src"),
  );
}

describe("CINEMATIC_MEDIA", () => {
  it("maps every approved final-media path and playback contract", () => {
    expect(Object.keys(CINEMATIC_MEDIA)).toEqual([
      "hero",
      "liquid",
      "cellar",
      "memory",
      "atlas",
    ]);
    expect(
      Object.fromEntries(
        Object.entries(CINEMATIC_MEDIA).map(([key, asset]) => [
          key,
          asset.playback,
        ]),
      ),
    ).toEqual({
      atlas: "once",
      cellar: "once",
      hero: "loop",
      liquid: "loop",
      memory: "loop",
    });

    for (const [key, media] of Object.entries(CINEMATIC_MEDIA)) {
      expect([
        media.desktop.webm,
        media.desktop.mp4,
        media.desktop.poster,
        media.mobile.webm,
        media.mobile.mp4,
        media.mobile.poster,
      ]).toEqual(expectedRegistryPaths[key as MediaKey]);
    }

    expect(CINEMATIC_MEDIA.atlas).toMatchObject({
      filter: "brightness(0.68) saturate(0.78)",
      opacity: 0.9,
    });
  });
});

describe("CinematicVideo", () => {
  let documentHidden = false;
  let mediaQueries: ReturnType<typeof createMatchMediaController>;
  let loadMock: ReturnType<typeof vi.spyOn>;
  let pauseMock: ReturnType<typeof vi.spyOn>;
  let playMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    documentHidden = false;
    IntersectionObserverMock.instances = [];
    mediaQueries = createMatchMediaController({
      [MOBILE_QUERY]: false,
      [REDUCED_MOTION_QUERY]: false,
    });
    vi.stubGlobal("matchMedia", mediaQueries.matchMedia);
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
      documentHidden ? "hidden" : "visible",
    );
    loadMock = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => undefined);
    pauseMock = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("eagerly prepares only the selected desktop hero source with WebM first", () => {
    const { container } = render(
      <CinematicVideo className="cinematic" mediaKey="hero" priority />,
    );
    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.hero.desktop.webm,
      CINEMATIC_MEDIA.hero.desktop.mp4,
    ]);
    expect(container.innerHTML).not.toContain("/mobile/");
    expect(video).toHaveAttribute(
      "poster",
      CINEMATIC_MEDIA.hero.desktop.poster,
    );
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveClass("cinematic");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).not.toHaveAttribute("controls");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.loop).toBe(true);
    expect(loadMock).toHaveBeenCalledOnce();
    expect(playMock).not.toHaveBeenCalled();
  });

  it("selects only the mobile variant for a mobile viewport", () => {
    mediaQueries = createMatchMediaController({
      [MOBILE_QUERY]: true,
      [REDUCED_MOTION_QUERY]: false,
    });
    vi.stubGlobal("matchMedia", mediaQueries.matchMedia);

    const { container } = render(
      <CinematicVideo mediaKey="hero" priority />,
    );

    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.hero.mobile.webm,
      CINEMATIC_MEDIA.hero.mobile.mp4,
    ]);
    expect(container.innerHTML).not.toContain("/desktop/");
    expect(container.querySelector("video")).toHaveAttribute(
      "poster",
      CINEMATIC_MEDIA.hero.mobile.poster,
    );
    expect(container.querySelector("video")).toHaveStyle({
      objectPosition: "center bottom",
    });
  });

  it.each(["hero", "liquid", "memory"] as const)(
    "renders %s with the native loop attribute",
    (mediaKey) => {
      const { container } = render(
        mediaKey === "hero" ? (
          <CinematicVideo mediaKey="hero" priority />
        ) : (
          <CinematicVideo mediaKey={mediaKey} />
        ),
      );

      expect(container.querySelector("video")?.loop).toBe(true);
    },
  );

  it("keeps later media source-free until near the viewport and plays only when meaningfully visible", async () => {
    const { container } = render(<CinematicVideo mediaKey="memory" />);
    const video = container.querySelector("video");

    expect(video).toHaveAttribute("preload", "none");
    expect(video).not.toHaveAttribute("poster");
    expect(getSourcePaths(container)).toEqual([]);

    act(() => {
      getActiveObserver(LOAD_ROOT_MARGIN).emit({
        intersectionRatio: 0.01,
        isIntersecting: true,
      });
    });

    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.memory.desktop.webm,
      CINEMATIC_MEDIA.memory.desktop.mp4,
    ]);
    expect(video).toHaveAttribute(
      "poster",
      CINEMATIC_MEDIA.memory.desktop.poster,
    );
    expect(video).toHaveAttribute("preload", "metadata");
    expect(loadMock).toHaveBeenCalledOnce();
    expect(playMock).not.toHaveBeenCalled();

    act(() => {
      getActiveObserver(PLAY_ROOT_MARGIN).emit({
        intersectionRatio: 0.2,
        isIntersecting: true,
      });
    });
    expect(playMock).not.toHaveBeenCalled();

    await act(async () => {
      getActiveObserver(PLAY_ROOT_MARGIN).emit({
        intersectionRatio: 0.6,
        isIntersecting: true,
      });
      await Promise.resolve();
    });
    expect(playMock).toHaveBeenCalledOnce();

    act(() => {
      getActiveObserver(PLAY_ROOT_MARGIN).emit({
        intersectionRatio: 0,
        isIntersecting: false,
      });
    });
    expect(pauseMock).toHaveBeenCalled();
  });

  it.each(["cellar", "atlas"] as const)(
    "holds the %s ending frame until its whole chapter exits, then resets and replays",
    async (mediaKey) => {
      const { container } = render(
        <section data-story-chapter={mediaKey}>
          <CinematicVideo mediaKey={mediaKey} />
        </section>,
      );

      act(() => {
        getActiveObserver(LOAD_ROOT_MARGIN).emit({
          intersectionRatio: 0.01,
          isIntersecting: true,
        });
      });

      const video = container.querySelector("video");
      const chapter = container.querySelector("section");
      if (!video || !chapter) throw new Error("Expected chapter media.");

      expect(video.loop).toBe(false);
      expect(getActiveObserver(PLAY_ROOT_MARGIN).targets.has(chapter)).toBe(true);
      expect(getActiveObserver(PLAY_ROOT_MARGIN).targets.has(video)).toBe(false);

      await act(async () => {
        getActiveObserver(PLAY_ROOT_MARGIN).emit({
          intersectionRatio: 0.7,
          isIntersecting: true,
        });
        await Promise.resolve();
      });
      expect(playMock).toHaveBeenCalledOnce();

      Object.defineProperty(video, "duration", { configurable: true, value: 5 });
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        value: 5,
        writable: true,
      });
      fireEvent.ended(video);

      act(() => {
        getActiveObserver(PLAY_ROOT_MARGIN).emit({
          intersectionRatio: 0.6,
          isIntersecting: true,
        });
      });
      expect(playMock).toHaveBeenCalledOnce();

      act(() => {
        getActiveObserver(PLAY_ROOT_MARGIN).emit({
          intersectionRatio: 0.12,
          isIntersecting: true,
        });
      });
      expect(video.currentTime).toBe(5);

      act(() => {
        getActiveObserver(PLAY_ROOT_MARGIN).emit({
          intersectionRatio: 0,
          isIntersecting: false,
        });
      });
      expect(video.currentTime).toBe(0);

      await act(async () => {
        getActiveObserver(PLAY_ROOT_MARGIN).emit({
          intersectionRatio: 0.7,
          isIntersecting: true,
        });
        await Promise.resolve();
      });
      expect(playMock).toHaveBeenCalledTimes(2);
    },
  );

  it("replaces a rejected autoplay attempt with its poster without retrying", async () => {
    playMock.mockRejectedValueOnce(
      new DOMException("Autoplay blocked", "NotAllowedError"),
    );
    const { container } = render(
      <CinematicVideo mediaKey="hero" priority />,
    );

    act(() => {
      getActiveObserver(PLAY_ROOT_MARGIN).emit({
        intersectionRatio: 0.8,
        isIntersecting: true,
      });
    });

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeInTheDocument();
    });
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      CINEMATIC_MEDIA.hero.desktop.poster,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(playMock).toHaveBeenCalledOnce();

    document.dispatchEvent(new Event("visibilitychange"));
    expect(playMock).toHaveBeenCalledOnce();
  });

  it("does not treat an intentionally aborted pending play as autoplay failure", async () => {
    let rejectPendingPlay: ((reason?: unknown) => void) | undefined;
    playMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPendingPlay = reject;
        }),
    );
    const { container } = render(
      <section data-story-chapter="hero">
        <CinematicVideo mediaKey="hero" priority />
      </section>,
    );
    const playbackObserver = getActiveObserver(PLAY_ROOT_MARGIN);

    act(() => {
      playbackObserver.emit({
        intersectionRatio: 0.8,
        isIntersecting: true,
      });
    });
    expect(playMock).toHaveBeenCalledOnce();

    act(() => {
      playbackObserver.emit({
        intersectionRatio: 0.2,
        isIntersecting: true,
      });
    });

    await act(async () => {
      rejectPendingPlay?.(new DOMException("Interrupted", "AbortError"));
      await Promise.resolve();
    });
    expect(container.querySelector("video")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();

    await act(async () => {
      playbackObserver.emit({
        intersectionRatio: 0.8,
        isIntersecting: true,
      });
      await Promise.resolve();
    });
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("preserves the atlas treatment on media-error poster fallback", () => {
    const { container } = render(
      <CinematicVideo className="atlas-media" mediaKey="atlas" />,
    );
    const video = container.querySelector("video");
    if (!video) throw new Error("Expected atlas video.");

    expect(video).toHaveStyle({
      filter: "brightness(0.68) saturate(0.78)",
      opacity: "0.9",
    });

    act(() => {
      getActiveObserver(LOAD_ROOT_MARGIN).emit({
        intersectionRatio: 0.01,
        isIntersecting: true,
      });
    });
    fireEvent.error(video);

    const poster = container.querySelector("img");
    expect(poster).toHaveAttribute(
      "src",
      CINEMATIC_MEDIA.atlas.desktop.poster,
    );
    expect(poster).toHaveClass("atlas-media");
    expect(poster).toHaveAttribute("aria-hidden", "true");
    expect(poster).toHaveStyle({
      filter: "brightness(0.68) saturate(0.78)",
      opacity: "0.9",
    });
  });

  it("renders only the selected poster and mounts no video for reduced motion", () => {
    mediaQueries = createMatchMediaController({
      [MOBILE_QUERY]: true,
      [REDUCED_MOTION_QUERY]: true,
    });
    vi.stubGlobal("matchMedia", mediaQueries.matchMedia);

    const { container } = render(
      <CinematicVideo mediaKey="hero" priority />,
    );
    const poster = container.querySelector("img");

    expect(poster).toHaveAttribute("src", CINEMATIC_MEDIA.hero.mobile.poster);
    expect(poster).toHaveAttribute("loading", "eager");
    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/\.(?:mp4|webm)/);
    expect(IntersectionObserverMock.instances).toHaveLength(0);
    expect(loadMock).not.toHaveBeenCalled();
    expect(playMock).not.toHaveBeenCalled();
  });

  it("pauses while the document is hidden and resumes only when still visible", async () => {
    render(<CinematicVideo mediaKey="hero" priority />);
    const playbackObserver = getActiveObserver(PLAY_ROOT_MARGIN);

    await act(async () => {
      playbackObserver.emit({
        intersectionRatio: 0.7,
        isIntersecting: true,
      });
      await Promise.resolve();
    });
    expect(playMock).toHaveBeenCalledOnce();

    documentHidden = true;
    fireEvent(document, new Event("visibilitychange"));
    expect(pauseMock).toHaveBeenCalled();

    documentHidden = false;
    await act(async () => {
      fireEvent(document, new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(playMock).toHaveBeenCalledTimes(2);

    act(() => {
      playbackObserver.emit({
        intersectionRatio: 0,
        isIntersecting: false,
      });
    });
    documentHidden = true;
    fireEvent(document, new Event("visibilitychange"));
    documentHidden = false;
    fireEvent(document, new Event("visibilitychange"));
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("cleans the old video and swaps to only the new viewport sources at the breakpoint", () => {
    const { container } = render(
      <CinematicVideo mediaKey="hero" priority />,
    );
    const desktopVideo = container.querySelector("video");

    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.hero.desktop.webm,
      CINEMATIC_MEDIA.hero.desktop.mp4,
    ]);

    act(() => mediaQueries.get(MOBILE_QUERY).setMatches(true));

    const mobileVideo = container.querySelector("video");
    expect(mobileVideo).not.toBe(desktopVideo);
    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.hero.mobile.webm,
      CINEMATIC_MEDIA.hero.mobile.mp4,
    ]);
    expect(container.innerHTML).not.toContain("/desktop/");
    expect(pauseMock).toHaveBeenCalled();
    expect(mediaQueries.get(MOBILE_QUERY).listeners.size).toBe(1);
    expect(mediaQueries.get(REDUCED_MOTION_QUERY).listeners.size).toBe(1);
  });

  it("drops stale lazy sources and reloads only the new non-hero viewport variant", () => {
    const { container } = render(<CinematicVideo mediaKey="memory" />);

    act(() => {
      getActiveObserver(LOAD_ROOT_MARGIN).emit({
        intersectionRatio: 0.01,
        isIntersecting: true,
      });
    });
    const desktopVideo = container.querySelector("video");
    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.memory.desktop.webm,
      CINEMATIC_MEDIA.memory.desktop.mp4,
    ]);

    pauseMock.mockClear();
    act(() => mediaQueries.get(MOBILE_QUERY).setMatches(true));

    const mobileVideo = container.querySelector("video");
    expect(mobileVideo).not.toBe(desktopVideo);
    expect(getSourcePaths(container)).toEqual([]);
    expect(container.innerHTML).not.toContain("/desktop/");
    expect(pauseMock.mock.instances).toContain(desktopVideo);

    act(() => {
      getActiveObserver(LOAD_ROOT_MARGIN).emit({
        intersectionRatio: 0.01,
        isIntersecting: true,
      });
    });
    expect(getSourcePaths(container)).toEqual([
      CINEMATIC_MEDIA.memory.mobile.webm,
      CINEMATIC_MEDIA.memory.mobile.mp4,
    ]);
    expect(container.innerHTML).not.toContain("/desktop/");
  });

  it("pauses the captured media element and disconnects observers on route unmount", () => {
    const { container, unmount } = render(
      <CinematicVideo mediaKey="hero" priority />,
    );
    const video = container.querySelector("video");
    pauseMock.mockClear();

    unmount();

    expect(pauseMock.mock.instances).toContain(video);
    expect(
      IntersectionObserverMock.instances.every(
        (observer) => observer.disconnected,
      ),
    ).toBe(true);
  });

  it("ignores an invalid non-hero priority request at runtime", () => {
    const invalidProps = {
      mediaKey: "memory",
      priority: true,
    } as unknown as CinematicVideoProps;
    const { container } = render(<CinematicVideo {...invalidProps} />);

    expect(container.querySelector("video")).toHaveAttribute(
      "preload",
      "none",
    );
    expect(getSourcePaths(container)).toEqual([]);
    expect(getActiveObserver(LOAD_ROOT_MARGIN)).toBeDefined();
  });

  it("falls back safely when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<CinematicVideo mediaKey="memory" />);

    await waitFor(() => {
      expect(getSourcePaths(container)).toEqual([
        CINEMATIC_MEDIA.memory.desktop.webm,
        CINEMATIC_MEDIA.memory.desktop.mp4,
      ]);
    });
    expect(loadMock).toHaveBeenCalledOnce();
    expect(playMock).toHaveBeenCalledOnce();
  });

  it("fully cleans observers and shares breakpoint listeners under Strict Mode", () => {
    const { unmount } = render(
      <StrictMode>
        <CinematicVideo mediaKey="hero" priority />
        <CinematicVideo mediaKey="liquid" />
      </StrictMode>,
    );

    expect(
      IntersectionObserverMock.instances.filter(
        (observer) => !observer.disconnected,
      ),
    ).toHaveLength(3);
    expect(mediaQueries.get(MOBILE_QUERY).listeners.size).toBe(1);
    expect(mediaQueries.get(REDUCED_MOTION_QUERY).listeners.size).toBe(1);

    unmount();

    expect(
      IntersectionObserverMock.instances.every(
        (observer) => observer.disconnected,
      ),
    ).toBe(true);
    expect(mediaQueries.get(MOBILE_QUERY).listeners.size).toBe(0);
    expect(mediaQueries.get(REDUCED_MOTION_QUERY).listeners.size).toBe(0);
  });
});
