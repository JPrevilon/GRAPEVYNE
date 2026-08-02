import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SceneProvider } from "./SceneProvider";
import { STORY_CHAPTERS, STORY_CHAPTER_KEYS } from "./storyChapters";
import { useScene } from "./useScene";

function SceneProbe() {
  const { chapter, homepageActive, prefersReducedMotion, setChapter } = useScene();

  return (
    <button onClick={() => setChapter("atlas")} type="button">
      {chapter}:{homepageActive ? "home" : "route"}:
      {prefersReducedMotion ? "reduced" : "motion"}
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

    expect(screen.getByRole("button")).toHaveTextContent("hero:route:motion");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("atlas:route:motion");
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

    expect(screen.getByRole("button")).toHaveTextContent("hero:route:reduced");
  });
});
