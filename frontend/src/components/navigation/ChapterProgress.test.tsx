import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SceneProvider } from "@/experience";
import type { SceneProgress } from "@/experience/sceneContextValue";
import { useScene } from "@/experience/useScene";

import ChapterProgress from "./ChapterProgress";

let capturedProgressRef: MutableRefObject<SceneProgress> | undefined;

function ProgressProbe() {
  capturedProgressRef = useScene().progressRef;
  return null;
}

function renderProgress() {
  return render(
    <SceneProvider>
      <ProgressProbe />
      <ChapterProgress />
    </SceneProvider>,
  );
}

describe("ChapterProgress", () => {
  afterEach(() => {
    cleanup();
    capturedProgressRef = undefined;
  });

  it("keeps a compact accessible current-state indicator", () => {
    renderProgress();
    const progress = screen.getByRole("progressbar", {
      name: "01 of 09 — DISCOVERY",
    });

    expect(progress).toHaveAttribute("aria-valuemin", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "9");
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("button", { name: /ALL CHAPTERS/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("reveals all nine keyboard-focusable hash links deliberately", () => {
    renderProgress();
    fireEvent.click(screen.getByRole("button", { name: /ALL CHAPTERS/i }));
    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(9);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#chapter-01-hero",
      "#chapter-02-discovery",
      "#chapter-03-match",
      "#chapter-04-taste",
      "#chapter-05-portal",
      "#chapter-06-cellar",
      "#chapter-07-memory",
      "#chapter-08-atlas",
      "#chapter-09-finale",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "step");
    links.forEach((link) => expect(link).not.toHaveAttribute("tabindex", "-1"));
  });

  it("requests a black-gated hash jump and closes the chapter menu", () => {
    renderProgress();
    fireEvent.click(screen.getByRole("button", { name: /ALL CHAPTERS/i }));
    fireEvent.click(screen.getByRole("link", { name: "TASTE ATLAS" }));

    expect(
      screen.getByRole("progressbar", { name: "01 of 09 — DISCOVERY" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(capturedProgressRef?.current.forceBlackGate).toBe(true);
    expect(capturedProgressRef?.current.navigationTargetIndex).toBe(7);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /ALL CHAPTERS/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /ALL CHAPTERS/i })).toHaveFocus();
  });
});
