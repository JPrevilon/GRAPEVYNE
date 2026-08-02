import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SceneProvider } from "@/experience";

import ChapterProgress from "./ChapterProgress";

describe("ChapterProgress", () => {
  afterEach(cleanup);

  it("provides an ordered, keyboard-focusable link for every chapter", () => {
    render(
      <SceneProvider>
        <ChapterProgress />
      </SceneProvider>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "From Vine to Memory chapters",
    });
    const links = screen.getAllByRole("link");

    expect(navigation).toBeInTheDocument();
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

  it("updates the current step when a chapter link is activated", () => {
    render(
      <SceneProvider>
        <ChapterProgress />
      </SceneProvider>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Atlas" }));

    expect(screen.getByRole("link", { name: "Atlas" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Chapter 8 of 9")).toBeInTheDocument();
  });
});
