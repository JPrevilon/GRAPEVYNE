import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import { SceneProvider, STORY_CHAPTERS } from "@/experience";

import HomePage from "./HomePage";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

const presentation = vi.hoisted(() => ({
  staticMode: false,
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    ...auth,
    status: "ready",
    user: auth.isAuthenticated ? { id: 1, name: "Test user" } : null,
  }),
}));

vi.mock("@/hooks/useScrollStory", () => ({ useScrollStory: vi.fn() }));
vi.mock("@/hooks/useStoryStaticMode", () => ({
  useStoryStaticMode: () => ({
    reason: presentation.staticMode ? "reduced-motion" : null,
    staticMode: presentation.staticMode,
  }),
}));
vi.mock("@/experience/StoryMediaStack", () => ({
  default: () => <div aria-hidden="true" data-testid="story-media-stack" />,
}));
vi.mock("@/experience/webgl/WebGLExperience", () => ({
  default: () => <div aria-hidden="true" data-testid="webgl-shell" />,
}));
vi.mock("@/experience/webgl/BottleInspectorModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div aria-label="Inspect the bottle" role="dialog">
      <button onClick={onClose} type="button">Close viewer</button>
    </div>
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

describe("HomePage cinematic story", () => {
  afterEach(cleanup);

  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.isLoading = false;
    presentation.staticMode = false;
  });

  it("renders one fixed visual stage and nine stable semantic chapter steps", () => {
    const { container } = renderHome();
    const chapters = Array.from(
      container.querySelectorAll<HTMLElement>("section[data-story-chapter]"),
    );

    expect(container.querySelectorAll("[data-story-stage]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-story-track]")).toHaveLength(1);
    expect(screen.getByTestId("story-media-stack")).toBeInTheDocument();
    expect(screen.getByTestId("webgl-shell")).toBeInTheDocument();
    expect(chapters).toHaveLength(9);
    expect(chapters.map(({ id }) => id)).toEqual(
      STORY_CHAPTERS.map(({ anchorId }) => anchorId),
    );
    expect(chapters.map(({ dataset }) => dataset.storyChapter)).toEqual(
      STORY_CHAPTERS.map(({ key }) => key),
    );
  });

  it("uses one semantic heading and the locked minimal copy in every chapter", () => {
    const { container } = renderHome();
    const expectedHeadings = [
      "FIND THE BOTTLE KEEP THE MEMORY",
      "DESCRIBE THE MOMENT",
      "WHY IT FITS",
      "TASTE TAKES SHAPE",
      "OPEN THE CELLAR",
      "BUILD THE COLLECTION",
      "REMEMBER THE POUR",
      "FOLLOW YOUR TASTE",
      "KEEP THE STORY",
    ];

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2")).toHaveLength(8);
    STORY_CHAPTERS.forEach((chapter, index) => {
      const section = container.querySelector<HTMLElement>(`#${chapter.anchorId}`);
      expect(section).not.toBeNull();
      expect(
        within(section as HTMLElement).getByRole("heading", {
          level: index === 0 ? 1 : 2,
          name: expectedHeadings[index],
        }),
      ).toBeInTheDocument();
      expect(within(section as HTMLElement).getByText(chapter.supportingLine)).toBeInTheDocument();
      expect(section?.querySelectorAll(".gv-brand-lockup")).toHaveLength(0);
    });
  });

  it("has one intentional homepage search and trims and encodes its route", () => {
    const { container } = renderHome();
    expect(container.querySelectorAll("form.gv-story-search")).toHaveLength(1);
    const input = screen.getByLabelText("Describe the moment");

    fireEvent.change(input, { target: { value: "  crisp white & oysters  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/discover?query=crisp%20white%20%26%20oysters",
    );
  });

  it("shows a truthful search validation error without navigating", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "SEARCH WINES" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Describe a wine/i);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });

  it("preserves discovery, auth-aware cellar, and profile route actions", () => {
    renderHome();
    expect(screen.getAllByRole("link", { name: /DISCOVER/i })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /CREATE CELLAR/i })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: /VIEW TASTE PROFILE/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("uses the protected Cellar route for an authenticated visitor", () => {
    auth.isAuthenticated = true;
    renderHome();
    expect(screen.getByRole("link", { name: /OPEN CELLAR/i })).toHaveAttribute(
      "href",
      "/cellar",
    );
  });

  it("opens the lazy dedicated bottle inspector from the Hero", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /INSPECT BOTTLE/i }));
    const dialog = await screen.findByRole("dialog", { name: /Inspect the bottle/i });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Close viewer/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders poster-only chapters and no stage runtime in static mode", () => {
    presentation.staticMode = true;
    const { container } = renderHome();
    expect(container.querySelector("[data-story-stage]")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".gv-story-static-visual")).toHaveLength(9);
    expect(container.querySelectorAll("video")).toHaveLength(0);
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
    expect(container.querySelectorAll(".gv-story-static-subject--bottle")).toHaveLength(3);
    expect(container.querySelectorAll(".gv-story-static-subject--grapes")).toHaveLength(1);
  });
});
