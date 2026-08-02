import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { AuthContextValue } from "@/features/auth/authContextValue";
import { useAuth } from "@/features/auth/useAuth";
import type { User } from "@/types/domain";

import ProfilePage from "./ProfilePage";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const user: User = {
  createdAt: "2026-01-17T12:00:00+00:00",
  email: "rachel@example.test",
  id: 17,
  name: "Rachel Vine",
  updatedAt: "2026-02-01T12:00:00+00:00",
};

function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user,
    ...overrides,
  };
}

function renderProfile() {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/profile"]}
    >
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/cellar" element={<h1>Private cellar destination</h1>} />
        <Route path="/discover" element={<h1>Discover destination</h1>} />
        <Route path="/login" element={<h1>Sign-in destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue(authValue());
});

afterEach(() => {
  cleanup();
  mockedUseAuth.mockReset();
});

describe("ProfilePage", () => {
  it("shows only fields returned by the authenticated user contract", () => {
    renderProfile();

    expect(
      screen.getByRole("heading", { level: 1, name: "TASTE PROFILE" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rachel Vine")).toBeInTheDocument();
    expect(screen.getByText("rachel@example.test")).toBeInTheDocument();
    expect(screen.getByText("January 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("January 17, 2026").closest("time")).toHaveAttribute(
      "datetime",
      user.createdAt,
    );
    expect(screen.queryByText(/bottles saved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/favorite region/i)).not.toBeInTheDocument();
  });

  it("states that personalization is not calculated instead of inventing it", () => {
    renderProfile();

    expect(
      screen.getByRole("heading", {
        name: "YOUR PERSONAL TASTE ATLAS HAS NOT BEEN CALCULATED",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not infer preferences, regions, scores, or statistics/i),
    ).toBeInTheDocument();
  });

  it("omits an account-created claim when the API timestamp is absent", () => {
    mockedUseAuth.mockReturnValue(
      authValue({ user: { ...user, createdAt: null } }),
    );
    renderProfile();

    expect(screen.queryByText("Account created")).not.toBeInTheDocument();
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });

  it("renders a session loading state without exposing account data", () => {
    mockedUseAuth.mockReturnValue(
      authValue({
        isAuthenticated: false,
        isLoading: true,
        status: "loading",
        user: null,
      }),
    );
    renderProfile();

    expect(screen.getByRole("status")).toHaveTextContent("OPENING YOUR PROFILE");
    expect(screen.queryByText("rachel@example.test")).not.toBeInTheDocument();
  });

  it("provides an honest sign-in recovery if rendered without a user", () => {
    mockedUseAuth.mockReturnValue(
      authValue({ isAuthenticated: false, user: null }),
    );
    renderProfile();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "THIS PROFILE NEEDS AN AUTHENTICATED SESSION",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("links to the two real product actions", () => {
    renderProfile();

    expect(screen.getByRole("link", { name: "Open my cellar" })).toHaveAttribute(
      "href",
      "/cellar",
    );
    fireEvent.click(screen.getByRole("link", { name: "Find a bottle" }));
    expect(
      screen.getByRole("heading", { name: "Discover destination" }),
    ).toBeInTheDocument();
  });
});
