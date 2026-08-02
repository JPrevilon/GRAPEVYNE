import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneProvider } from "@/experience";

import ChapterProgress from "./ChapterProgress";

const scrollIntoViewMock = vi.fn();

describe("ChapterProgress", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    scrollIntoViewMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

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

    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "TASTE ATLAS" }));

    expect(screen.getByRole("link", { name: "TASTE ATLAS" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Chapter 8 of 9")).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  });
});
