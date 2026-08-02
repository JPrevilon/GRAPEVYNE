import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "../../types/domain";
import { AuthProvider } from "./AuthContext";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "./authApi";
import { privateQueryKey } from "./privateQueryKeys";
import { useAuth } from "./useAuth";

vi.mock("./authApi", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedLogin = vi.mocked(loginRequest);
const mockedLogout = vi.mocked(logoutRequest);
const testUser = {
  createdAt: "2026-01-02T03:04:05+00:00",
  email: "cellar@example.com",
  id: 17,
  name: "Cellar Owner",
  updatedAt: "2026-01-02T03:04:05+00:00",
} as User;

function AuthProbe() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  return (
    <div>
      <output data-testid="auth-state">
        {isLoading ? "loading" : isAuthenticated ? user?.email : "anonymous"}
      </output>
      <button
        onClick={() => {
          void login({
            email: "new-session@example.com",
            password: "correct horse battery staple",
          });
        }}
        type="button"
      >
        Log in
      </button>
      <button
        onClick={() => {
          void logout().catch(() => undefined);
        }}
        type="button"
      >
        Log out
      </button>
    </div>
  );
}

function TestProviders({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("AuthProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue({
      data: { authenticated: true, user: testUser },
    });
    mockedLogin.mockResolvedValue({
      data: {
        authenticated: true,
        user: { ...testUser, email: "new-session@example.com", id: 18 },
      },
    });
    mockedLogout.mockResolvedValue({ data: { authenticated: false } });
  });

  it("boots the existing session through GET /auth/me", async () => {
    const queryClient = createTestQueryClient();

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>
    );

    expect(screen.getByTestId("auth-state")).toHaveTextContent("loading");
    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "cellar@example.com"
      )
    );
    expect(mockedGetCurrentUser).toHaveBeenCalledOnce();
  });

  it("does not let a late boot response overwrite a newer login", async () => {
    const queryClient = createTestQueryClient();
    let resolveBoot: ((value: { data: { authenticated: true; user: User } }) => void) | undefined;
    mockedGetCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveBoot = resolve;
      }),
    );

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("new-session@example.com");

    act(() => {
      resolveBoot?.({ data: { authenticated: true, user: testUser } });
    });

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "new-session@example.com",
      ),
    );
  });

  it("keeps the authenticated user and private cache when logout fails", async () => {
    const queryClient = createTestQueryClient();
    mockedLogout.mockRejectedValueOnce(new Error("API unavailable"));

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>
    );
    await screen.findByText("cellar@example.com");

    act(() => {
      queryClient.setQueryData(
        privateQueryKey(testUser.id, "cellar"),
        ["private bottle"]
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(mockedLogout).toHaveBeenCalledOnce());
    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      "cellar@example.com"
    );
    expect(
      queryClient.getQueryData(privateQueryKey(testUser.id, "cellar"))
    ).toEqual(["private bottle"]);
  });

  it("clears user-scoped private queries after a successful logout", async () => {
    const queryClient = createTestQueryClient();

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>
    );
    await screen.findByText("cellar@example.com");

    act(() => {
      queryClient.setQueryData(
        privateQueryKey(testUser.id, "cellar"),
        ["private bottle"]
      );
      queryClient.setQueryData(["public", "wine", 4], "public bottle");
      queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => "updated private notes",
        mutationKey: privateQueryKey(testUser.id, "cellar", "update"),
      });
      queryClient.getMutationCache().build(queryClient, {
        mutationFn: async () => "public result",
        mutationKey: ["public", "feedback"],
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous")
    );
    expect(
      queryClient.getQueryData(privateQueryKey(testUser.id, "cellar"))
    ).toBeUndefined();
    expect(queryClient.getQueryData(["public", "wine", 4])).toBe(
      "public bottle"
    );
    expect(
      queryClient.getMutationCache().findAll({
        mutationKey: privateQueryKey(testUser.id, "cellar", "update"),
      }),
    ).toHaveLength(0);
    expect(
      queryClient.getMutationCache().findAll({ mutationKey: ["public"] }),
    ).toHaveLength(1);
  });
});
