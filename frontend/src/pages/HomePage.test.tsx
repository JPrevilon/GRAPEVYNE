import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { STORY_CHAPTERS, SceneProvider } from "@/experience";

import HomePage from "./HomePage";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

const webgl = vi.hoisted(() => ({
  onReadyChange: null as ((ready: boolean) => void) | null,
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    ...auth,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user: auth.isAuthenticated ? { id: 1, name: "Test user" } : null,
  }),
}));

vi.mock("@/hooks/useScrollStory", () => ({
  useScrollStory: vi.fn(),
}));

vi.mock("@/experience/CinematicVideo", () => ({
  default: ({ mediaKey }: { mediaKey: string }) => (
    <span aria-hidden="true" data-media-key={mediaKey} />
  ),
}));

vi.mock("@/experience/webgl/WebGLExperience", () => ({
  default: ({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) => {
    webgl.onReadyChange = onReadyChange;
    return <div aria-hidden="true" data-testid="webgl-lazy-shell" />;
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderHome() {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/"]}
    >
      <SceneProvider>
        <HomePage />
        <LocationProbe />
      </SceneProvider>
    </MemoryRouter>,
  );
}

describe("HomePage scroll story", () => {
  afterEach(cleanup);

  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.isLoading = false;
    webgl.onReadyChange = null;
  });

  it("renders all nine semantic chapters from the shared ordered configuration", () => {
    const { container } = renderHome();
    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section[data-story-chapter]"),
    );

    expect(chapters).toHaveLength(9);
    expect(chapters.map((chapter) => chapter.id)).toEqual(
      STORY_CHAPTERS.map(({ anchorId }) => anchorId),
    );
    expect(chapters.map((chapter) => chapter.dataset.storyChapter)).toEqual(
      STORY_CHAPTERS.map(({ key }) => key),
    );

    chapters.forEach((chapter) => {
      const headingId = chapter.getAttribute("aria-labelledby");
      expect(headingId).toBeTruthy();
      expect(chapter.querySelector(`#${headingId}`)).toBeInstanceOf(HTMLHeadingElement);
    });
    expect(container.querySelector("main")).not.toBeInTheDocument();
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(container.querySelector("model-viewer")).not.toBeInTheDocument();
  });

  it("keeps the CSS bottle mounted until and after the WebGL frame handshake", () => {
    const { container } = renderHome();
    const story = container.querySelector(".gv-story");
    const fallback = container.querySelector(".gv-hero-bottle");

    expect(screen.getByTestId("webgl-lazy-shell")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(story).not.toHaveClass("gv-story--webgl-ready");
    expect(fallback).toBeInTheDocument();
    expect(container.querySelector("canvas")).not.toBeInTheDocument();

    act(() => {
      webgl.onReadyChange?.(true);
    });
    expect(story).toHaveClass("gv-story--webgl-ready");
    expect(fallback).toBeInTheDocument();

    act(() => {
      webgl.onReadyChange?.(false);
    });
    expect(story).not.toHaveClass("gv-story--webgl-ready");
    expect(fallback).toBeInTheDocument();
  });

  it("renders the locked accessible title compositions and directory labels", () => {
    const { container } = renderHome();
    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section[data-story-chapter]"),
    );
    const expectedHeadings = [
      "FIND THE BOTTLE KEEP THE MEMORY",
      "DESCRIBE THE MOMENT",
      "WHY IT FITS",
      "TASTE TAKES SHAPE",
      "OPEN THE CELLAR",
      "BUILD THE COLLECTION",
      "REMEMBER THE POUR",
      "YOUR TASTE ATLAS",
      "KEEP THE STORY",
    ];
    const expectedLabels = [
      "01 / DISCOVERY",
      "02 / SEARCH",
      "03 / MATCH LOGIC",
      "04 / TASTE SIGNALS",
      "05 / PRIVATE CELLAR",
      "06 / COLLECTION",
      "07 / TASTING MEMORY",
      "08 / TASTE ATLAS",
      "09 / GRAPEVYNE",
    ];
    const expectedCompositions = [
      ["FIND THE|small|light|base", "BOTTLE|large|regular|base", "KEEP THE|micro|light|base", "MEMORY|medium|regular|accent"],
      ["DESCRIBE|small|light|base", "THE MOMENT|large|regular|base"],
      ["WHY|micro|light|base", "IT FITS|large|regular|base"],
      ["TASTE|small|light|base", "TAKES SHAPE|large|regular|base"],
      ["OPEN|small|light|base", "THE CELLAR|large|regular|base"],
      ["BUILD|small|light|base", "THE COLLECTION|large|regular|base"],
      ["REMEMBER|small|light|base", "THE POUR|large|regular|base"],
      ["YOUR|micro|light|base", "TASTE ATLAS|large|regular|base"],
      ["KEEP|small|light|base", "THE STORY|large|regular|base"],
    ];

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2")).toHaveLength(8);
    expect(
      STORY_CHAPTERS.map(({ headingSegments }) =>
        headingSegments.map((segment) =>
          [
            segment.text,
            segment.size,
            segment.weight,
            "accent" in segment && segment.accent ? "accent" : "base",
          ].join("|"),
        ),
      ),
    ).toEqual(expectedCompositions);

    chapters.forEach((chapter, index) => {
      const definition = STORY_CHAPTERS[index]!;
      const heading = within(chapter).getByRole("heading", {
        level: index === 0 ? 1 : 2,
        name: expectedHeadings[index],
      });
      const segments = Array.from(
        heading.querySelectorAll<HTMLElement>(".gv-directory-heading__segment"),
      );

      expect(heading.getAttribute("aria-label")).not.toMatch(/[.!?]$/);
      expect(heading.querySelector(".gv-directory-heading__visual")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(segments.map((segment) => segment.textContent?.trim())).toEqual(
        definition.headingSegments.map(({ text }) => text),
      );
      definition.headingSegments.forEach((segment, segmentIndex) => {
        expect(segments[segmentIndex]).toHaveClass(
          `gv-directory-heading__segment--size-${segment.size}`,
          `gv-directory-heading__segment--weight-${segment.weight}`,
        );
        if ("accent" in segment && segment.accent) {
          expect(segments[segmentIndex]).toHaveClass(
            "gv-directory-heading__segment--accent",
          );
        }
      });
    });

    expect(
      chapters.map((chapter) =>
        chapter
          .querySelector(".gv-story-heading__number")
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
      ),
    ).toEqual(expectedLabels);
  });

  it("trims and encodes natural-language discovery navigation", () => {
    renderHome();
    const input = screen.getByLabelText("What is the bottle for?");

    fireEvent.change(input, { target: { value: "  crisp white & oysters  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/discover?query=crisp%20white%20%26%20oysters",
    );
  });

  it("connects shortcuts and signed-out calls to real public and auth routes", () => {
    renderHome();

    expect(screen.getByRole("link", { name: /Begin the tasting/i })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(
      screen.getByRole("link", { name: "Bold red for steak night" }),
    ).toHaveAttribute("href", "/discover?query=Bold%20red%20for%20steak%20night");
    expect(screen.getAllByRole("link", { name: /Create my cellar/i })).not.toHaveLength(0);
    screen.getAllByRole("link", { name: /Create my cellar/i }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/signup");
    });
    expect(screen.getByRole("link", { name: /Create your cellar/i })).toHaveAttribute(
      "href",
      "/signup",
    );
    screen.getAllByRole("link", { name: "Explore the demo cellar" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/demo/cellar");
    });
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: /View source/i })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("uses authenticated state for protected cellar and profile calls", () => {
    auth.isAuthenticated = true;
    renderHome();

    screen.getAllByRole("link", { name: /Open my cellar/i }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/cellar");
    });
    expect(screen.getByRole("link", { name: "View my profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("labels every illustrative state and never renders a personalized percentage", () => {
    const { container } = renderHome();

    expect(screen.getByText("Demonstration of match reasoning")).toBeInTheDocument();
    expect(screen.getByText("Demonstration tasting memory")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: /Demonstration of future taste/i }),
      ).getByText("Fresh & mineral"),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d+\s*%/);
    expect(container.textContent).toMatch(/personalized engine is not implemented yet/i);
  });

  it("keeps the engineering disclosure factual about implemented WebGL and deferred engines", () => {
    renderHome();

    expect(
      screen.getByText(/persistent React Three Fiber WebGL bottle/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/local desktop and mobile GLB models/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A recommendation engine and personalized Taste Atlas remain future work/i),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      "WebGL, a recommendation engine, and a personalized Taste Atlas remain future work.",
    );
  });
});
