import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../../features/auth/useAuth";
import ProtectedRoute from "./ProtectedRoute";

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const refreshUser = vi.fn<() => Promise<void>>();

function LoginProbe() {
  const location = useLocation();

  return (
    <output data-testid="login-location">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </output>
  );
}

function protectedRouteTree(children = <h1>Private cellar</h1>) {
  return (
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/cellar?sort=rating#bottles"]}
    >
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              {children}
            </ProtectedRoute>
          }
          path="/cellar"
        />
        <Route element={<LoginProbe />} path="/login" />
      </Routes>
    </MemoryRouter>
  );
}

function renderProtectedRoute(children = <h1>Private cellar</h1>) {
  return render(protectedRouteTree(children));
}

describe("ProtectedRoute", () => {
  afterEach(cleanup);

  beforeEach(() => {
    refreshUser.mockReset();
    refreshUser.mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      error: null,
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "ready",
      user: null,
    } as ReturnType<typeof useAuth>);
  });

  it("redirects anonymous visitors and retains pathname, search, and hash", () => {
    renderProtectedRoute();

    expect(screen.getByTestId("login-location")).toHaveTextContent(
      JSON.stringify({
        pathname: "/login",
        state: { from: "/cellar?sort=rating#bottles" },
      })
    );
    expect(screen.queryByText("Private cellar")).not.toBeInTheDocument();
  });

  it("shows an accessible loading state while session boot is pending", () => {
    mockedUseAuth.mockReturnValue({
      error: null,
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "loading",
      user: null,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(screen.getByRole("status")).toHaveTextContent("OPENING GRAPEVYNE");
  });

  it("does not redirect or query private UI when the session service is unavailable", () => {
    mockedUseAuth.mockReturnValue({
      error: new Error("Could not reach the GrapeVyne API."),
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "error",
      user: null,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(
      screen.getByRole("heading", {
        name: "YOUR PRIVATE SESSION COULD NOT BE VERIFIED",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("login-location")).not.toBeInTheDocument();
    expect(screen.queryByText("Private cellar")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Check session again" }),
    );
    expect(refreshUser).toHaveBeenCalledOnce();
  });

  it("preserves but hides private draft state during known-session revalidation", () => {
    const user = {
      createdAt: "2026-08-02T12:00:00+00:00",
      email: "live@example.com",
      id: 42,
      name: "Live User",
      updatedAt: "2026-08-02T12:00:00+00:00",
    };
    mockedUseAuth.mockReturnValue({
      error: null,
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "ready",
      user,
    } as ReturnType<typeof useAuth>);

    const draft = (
      <input aria-label="Private tasting draft" defaultValue="Black cherry" />
    );
    const view = renderProtectedRoute(draft);
    fireEvent.change(screen.getByLabelText("Private tasting draft"), {
      target: { value: "Black cherry and cedar" },
    });

    mockedUseAuth.mockReturnValue({
      error: null,
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: true,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "loading",
      user,
    } as ReturnType<typeof useAuth>);
    view.rerender(protectedRouteTree(draft));

    expect(screen.getByRole("status")).toHaveTextContent("OPENING GRAPEVYNE");
    expect(screen.getByLabelText("Private tasting draft")).not.toBeVisible();

    mockedUseAuth.mockReturnValue({
      error: null,
      handleAuthenticationRequired: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser,
      signup: vi.fn(),
      status: "ready",
      user,
    } as ReturnType<typeof useAuth>);
    view.rerender(protectedRouteTree(draft));

    expect(screen.getByLabelText("Private tasting draft")).toBeVisible();
    expect(screen.getByLabelText("Private tasting draft")).toHaveValue(
      "Black cherry and cedar",
    );
  });
});
