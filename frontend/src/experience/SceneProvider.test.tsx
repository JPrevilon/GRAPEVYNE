import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SceneProvider } from "./SceneProvider";
import { STORY_CHAPTERS } from "./sceneContextValue";
import { useScene } from "./useScene";

function SceneProbe() {
  const { chapter, setChapter } = useScene();

  return (
    <button onClick={() => setChapter("atlas")} type="button">
      {chapter}
    </button>
  );
}

describe("SceneProvider", () => {
  afterEach(cleanup);

  it("exposes exactly the nine lightweight story chapter keys", () => {
    expect(STORY_CHAPTERS).toEqual([
      "hero",
      "discover",
      "match",
      "taste",
      "portal",
      "cellar",
      "memory",
      "atlas",
      "finale",
    ]);
  });

  it("tracks chapter state without creating a canvas or video", () => {
    const { container } = render(
      <SceneProvider>
        <SceneProbe />
      </SceneProvider>
    );

    expect(screen.getByRole("button")).toHaveTextContent("hero");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("atlas");
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });
});
