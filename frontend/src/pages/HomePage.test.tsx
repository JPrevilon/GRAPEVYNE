import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { STORY_CHAPTERS, SceneProvider } from "@/experience";

import HomePage from "./HomePage";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
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

  it("renders the locked punctuation-free display copy and directory labels", () => {
    const { container } = renderHome();
    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section[data-story-chapter]"),
    );
    const headings = chapters.map((chapter) =>
      chapter.querySelector<HTMLHeadingElement>("h1, h2"),
    );
    const expectedHeadings = [
      /FIND THE BOTTLE\s*KEEP THE MEMORY/,
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

    headings.forEach((heading, index) => {
      expect(heading).not.toBeNull();
      const text = heading?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const expected = expectedHeadings[index];

      if (expected instanceof RegExp) {
        expect(text).toMatch(expected);
      } else {
        expect(text).toBe(expected);
      }
      expect(text).not.toMatch(/[.!?]$/);
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
});
