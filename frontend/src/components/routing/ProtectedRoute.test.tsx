import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../../features/auth/useAuth";
import ProtectedRoute from "./ProtectedRoute";

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function LoginProbe() {
  const location = useLocation();

  return (
    <output data-testid="login-location">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </output>
  );
}

function renderProtectedRoute() {
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/cellar?sort=rating#bottles"]}
    >
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <h1>Private cellar</h1>
            </ProtectedRoute>
          }
          path="/cellar"
        />
        <Route element={<LoginProbe />} path="/login" />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
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
      isAuthenticated: false,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(screen.getByRole("status")).toHaveTextContent("Opening GRAPEVYNE");
  });
});
