import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SceneProvider } from "./SceneProvider";
import { STORY_CHAPTERS, STORY_CHAPTER_KEYS } from "./storyChapters";
import { useScene } from "./useScene";

function SceneProbe() {
  const {
    chapter,
    homepageActive,
    prefersReducedMotion,
    progressRef,
    setChapter,
    setHomepageActive,
  } = useScene();
  const initialProgressRef = useRef(progressRef);

  return (
    <button
      data-progress-ref-stable={initialProgressRef.current === progressRef}
      onClick={() => {
        progressRef.current.chapter = 0.75;
        progressRef.current.story = 0.5;
        progressRef.current.storyVisible = true;
        setChapter("atlas");
        setHomepageActive(true);
      }}
      type="button"
    >
      {chapter}:{homepageActive ? "home" : "route"}:
      {prefersReducedMotion ? "reduced" : "motion"}:
      {progressRef.current.chapter}:{progressRef.current.story}:
      {progressRef.current.storyVisible ? "visible" : "hidden"}
    </button>
  );
}

describe("SceneProvider", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("exposes exactly the nine lightweight story chapter keys", () => {
    expect(STORY_CHAPTER_KEYS).toEqual([
      "hero",
      "discovery",
      "match",
      "taste",
      "portal",
      "cellar",
      "memory",
      "atlas",
      "finale",
    ]);
    expect(STORY_CHAPTERS.map(({ anchorId }) => anchorId)).toEqual([
      "chapter-01-hero",
      "chapter-02-discovery",
      "chapter-03-match",
      "chapter-04-taste",
      "chapter-05-portal",
      "chapter-06-cellar",
      "chapter-07-memory",
      "chapter-08-atlas",
      "chapter-09-finale",
    ]);
  });

  it("tracks chapter state without creating a canvas or video", () => {
    const { container } = render(
      <SceneProvider>
        <SceneProbe />
      </SceneProvider>
    );

    expect(screen.getByRole("button")).toHaveTextContent(
      "hero:route:motion:0:0:hidden",
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent(
      "atlas:home:motion:0.75:0.5:visible",
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-progress-ref-stable",
      "true",
    );
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("uses the initial reduced-motion preference before children render", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    render(
      <SceneProvider>
        <SceneProbe />
      </SceneProvider>,
    );

    expect(screen.getByRole("button")).toHaveTextContent(
      "hero:route:reduced:0:0:hidden",
    );
  });
});
