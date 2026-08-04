import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SceneProvider } from "@/experience";

import ChapterProgress from "./ChapterProgress";

function renderProgress() {
  return render(
    <SceneProvider>
      <ChapterProgress />
    </SceneProvider>,
  );
}

describe("ChapterProgress", () => {
  afterEach(cleanup);

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

  it("updates the compact state and closes the chapter menu on activation", () => {
    renderProgress();
    fireEvent.click(screen.getByRole("button", { name: /ALL CHAPTERS/i }));
    fireEvent.click(screen.getByRole("link", { name: "TASTE ATLAS" }));

    expect(
      screen.getByRole("progressbar", { name: "08 of 09 — TASTE ATLAS" }),
    ).toHaveAttribute("aria-valuenow", "8");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /ALL CHAPTERS/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /ALL CHAPTERS/i })).toHaveFocus();
  });
});
