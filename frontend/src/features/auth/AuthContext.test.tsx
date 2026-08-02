import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from "../../api/auth";
import type { User } from "../../types/domain";
import { ToastProvider } from "../../components/ui/ToastProvider.jsx";
import { useToast } from "../../components/ui/useToast.js";
import { AuthProvider } from "./AuthContext";
import { privateQueryKey } from "./privateQueryKeys";
import { useAuth } from "./useAuth";

vi.mock("../../api/auth", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedLogin = vi.mocked(loginRequest);
const mockedLogout = vi.mocked(logoutRequest);
const mockedSignup = vi.mocked(signupRequest);
const testUser = {
  createdAt: "2026-01-02T03:04:05+00:00",
  email: "cellar@example.com",
  id: 17,
  name: "Cellar Owner",
  updatedAt: "2026-01-02T03:04:05+00:00",
} as User;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  readonly name: string;
  readonly postMessage = vi.fn((data: unknown) => {
    FakeBroadcastChannel.instances
      .filter((channel) => channel.name === this.name && !channel.closed)
      .forEach((channel) => channel.emit(data));
  });
  closed = false;
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void,
  ) {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  close() {
    this.closed = true;
    this.listeners.clear();
  }

  emit(data: unknown) {
    this.listeners.forEach((listener) =>
      listener(new MessageEvent("message", { data })),
    );
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void,
  ) {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  static reset() {
    FakeBroadcastChannel.instances = [];
  }
}

function AuthProbe() {
  const { showToast } = useToast();
  const {
    error,
    handleAuthenticationRequired,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
    signup,
    status,
    user,
  } = useAuth();

  return (
    <div>
      <output data-testid="auth-state">
        {status === "error"
          ? `unavailable:${error?.message}`
          : isLoading
            ? "loading"
            : isAuthenticated
              ? user?.email
              : "anonymous"}
      </output>
      <button
        onClick={() => {
          void login({
            email: "new-session@example.com",
            password: "correct horse battery staple",
          }).catch(() => undefined);
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
      <button onClick={() => void refreshUser()} type="button">
        Refresh session
      </button>
      <button
        onClick={() => {
          void signup({
            email: "signup@example.com",
            name: "Signup Session",
            password: "correct horse battery staple",
          }).catch(() => undefined);
        }}
        type="button"
      >
        Sign up
      </button>
      <button
        onClick={() => {
          if (user) {
            void handleAuthenticationRequired(user.id);
          }
        }}
        type="button"
      >
        Expire current session
      </button>
      <button
        onClick={() => void handleAuthenticationRequired(testUser.id)}
        type="button"
      >
        Expire old session
      </button>
      <button
        onClick={() =>
          showToast({
            message: "Private Reserve was updated.",
            title: "Bottle updated",
          })
        }
        type="button"
      >
        Show private notification
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
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    FakeBroadcastChannel.reset();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue(testUser);
    mockedLogin.mockResolvedValue({
      ...testUser,
      email: "new-session@example.com",
      id: 18,
    });
    mockedLogout.mockResolvedValue({ authenticated: false });
    mockedSignup.mockResolvedValue({
      ...testUser,
      email: "signup@example.com",
      id: 19,
      name: "Signup Session",
    });
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

  it("revalidates the session on window focus and when the page becomes visible", async () => {
    const queryClient = createTestQueryClient();

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(3));
  });

  it("clears private notifications as soon as session revalidation begins", async () => {
    const queryClient = createTestQueryClient();
    let resolveRevalidation: ((value: User) => void) | undefined;

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    fireEvent.click(
      screen.getByRole("button", { name: "Show private notification" }),
    );
    expect(screen.getByText("Private Reserve was updated.")).toBeInTheDocument();

    mockedGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise<User>((resolve) => {
          resolveRevalidation = resolve;
        }),
    );
    act(() => window.dispatchEvent(new Event("focus")));

    await screen.findByText("loading");
    expect(
      screen.queryByText("Private Reserve was updated."),
    ).not.toBeInTheDocument();

    act(() => resolveRevalidation?.(testUser));
    await screen.findByText("cellar@example.com");
  });

  it("coalesces paired visible and focus lifecycle events", async () => {
    const queryClient = createTestQueryClient();
    let resolveRevalidation: ((value: User) => void) | undefined;

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    mockedGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise<User>((resolve) => {
          resolveRevalidation = resolve;
        }),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2));
    act(() => resolveRevalidation?.(testUser));
    await screen.findByText("cellar@example.com");
    await Promise.resolve();
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("does not let lifecycle revalidation interrupt an explicit login", async () => {
    const queryClient = createTestQueryClient();
    let loginSignal: AbortSignal | undefined;
    let resolveLogin: ((value: User) => void) | undefined;

    mockedLogin.mockImplementation((_input, signal) => {
      loginSignal = signal;
      return new Promise<User>((resolve) => {
        resolveLogin = resolve;
      });
    });

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(loginSignal).toBeDefined());

    act(() => window.dispatchEvent(new Event("focus")));

    expect(loginSignal?.aborted).toBe(false);
    expect(mockedGetCurrentUser).toHaveBeenCalledOnce();

    act(() => {
      resolveLogin?.({
        ...testUser,
        email: "new-session@example.com",
        id: 18,
      });
    });
    await screen.findByText("new-session@example.com");
  });

  it("drains a remote session change after a failing explicit login", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const queryClient = createTestQueryClient();
    let rejectLogin: ((reason: Error) => void) | undefined;
    let loginSignal: AbortSignal | undefined;

    mockedLogin.mockImplementation((_input, signal) => {
      loginSignal = signal;
      return new Promise<User>((_resolve, reject) => {
        rejectLogin = reject;
      });
    });

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");

    const remoteUser = {
      ...testUser,
      email: "remote-session@example.com",
      id: 23,
    };
    mockedGetCurrentUser.mockResolvedValue(remoteUser);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(loginSignal).toBeDefined());

    act(() => {
      FakeBroadcastChannel.instances[0]?.emit({
        action: "login",
        sequence: 1,
        sourceId: "another-tab",
        type: "grapevyne-auth-session-changed",
        version: 1,
      });
    });
    expect(loginSignal?.aborted).toBe(false);
    expect(mockedGetCurrentUser).toHaveBeenCalledOnce();

    act(() => rejectLogin?.(new Error("Login request failed.")));

    await screen.findByText("remote-session@example.com");
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);
  });

  it("hides the prior identity while a remote session change is unresolved", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const queryClient = createTestQueryClient();
    let resolveRevalidation: ((value: User) => void) | undefined;

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    mockedGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise<User>((resolve) => {
          resolveRevalidation = resolve;
        }),
    );

    act(() => {
      FakeBroadcastChannel.instances[0]?.emit({
        action: "logout",
        sequence: 1,
        sourceId: "another-tab",
        type: "grapevyne-auth-session-changed",
        version: 1,
      });
    });

    await screen.findByText("loading");

    act(() => {
      resolveRevalidation?.({
        ...testUser,
        email: "remote-session@example.com",
        id: 23,
      });
    });
    await screen.findByText("remote-session@example.com");
  });

  it("queues an auth-required signal behind an in-flight revalidation", async () => {
    const queryClient = createTestQueryClient();
    let resolveFirstRevalidation: ((value: User) => void) | undefined;

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    mockedGetCurrentUser
      .mockImplementationOnce(
        () =>
          new Promise<User>((resolve) => {
            resolveFirstRevalidation = resolve;
          }),
      )
      .mockRejectedValueOnce(
        new ApiError("Authentication is required.", {
          code: "authentication_required",
          status: 401,
        }),
      );

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2));
    fireEvent.click(
      screen.getByRole("button", { name: "Expire current session" }),
    );

    act(() => resolveFirstRevalidation?.(testUser));

    await screen.findByText("anonymous");
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(3);
  });

  it("synchronizes successful login, signup, and logout across tabs without a self-loop", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const firstClient = createTestQueryClient();
    const secondClient = createTestQueryClient();
    const firstTab = render(
      <TestProviders queryClient={firstClient}>
        <AuthProbe />
      </TestProviders>,
    );
    const secondTab = render(
      <TestProviders queryClient={secondClient}>
        <AuthProbe />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(within(firstTab.container).getByTestId("auth-state")).toHaveTextContent(
        "cellar@example.com",
      );
      expect(within(secondTab.container).getByTestId("auth-state")).toHaveTextContent(
        "cellar@example.com",
      );
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);

    const loggedInUser = {
      ...testUser,
      email: "new-session@example.com",
      id: 18,
    };
    mockedGetCurrentUser.mockResolvedValue(loggedInUser);
    fireEvent.click(
      within(firstTab.container).getByRole("button", { name: "Log in" }),
    );

    await waitFor(() => {
      expect(within(firstTab.container).getByTestId("auth-state")).toHaveTextContent(
        "new-session@example.com",
      );
      expect(within(secondTab.container).getByTestId("auth-state")).toHaveTextContent(
        "new-session@example.com",
      );
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(3);

    const signedUpUser = {
      ...testUser,
      email: "signup@example.com",
      id: 19,
      name: "Signup Session",
    };
    mockedGetCurrentUser.mockResolvedValue(signedUpUser);
    fireEvent.click(
      within(firstTab.container).getByRole("button", { name: "Sign up" }),
    );

    await waitFor(() => {
      expect(within(firstTab.container).getByTestId("auth-state")).toHaveTextContent(
        "signup@example.com",
      );
      expect(within(secondTab.container).getByTestId("auth-state")).toHaveTextContent(
        "signup@example.com",
      );
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(4);

    mockedGetCurrentUser.mockRejectedValue(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );
    fireEvent.click(
      within(firstTab.container).getByRole("button", { name: "Log out" }),
    );

    await waitFor(() => {
      expect(within(firstTab.container).getByTestId("auth-state")).toHaveTextContent("anonymous");
      expect(within(secondTab.container).getByTestId("auth-state")).toHaveTextContent("anonymous");
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(5);
    expect(
      FakeBroadcastChannel.instances.flatMap((channel) =>
        channel.postMessage.mock.calls.map(
          ([message]) => (message as { action: string }).action,
        ),
      ),
    ).toEqual(["login", "signup", "logout"]);
  });

  it("does not let a late boot response overwrite a newer login", async () => {
    const queryClient = createTestQueryClient();
    let resolveBoot: ((value: User) => void) | undefined;
    let bootSignal: AbortSignal | undefined;
    mockedGetCurrentUser.mockImplementation((signal) => {
      bootSignal = signal;
      return (
      new Promise((resolve) => {
        resolveBoot = resolve;
      })
      );
    });

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("new-session@example.com");
    expect(bootSignal?.aborted).toBe(true);

    act(() => {
      resolveBoot?.(testUser);
    });

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "new-session@example.com",
      ),
    );
  });

  it("treats an unauthorized session refresh as a resolved anonymous state", async () => {
    const queryClient = createTestQueryClient();
    mockedGetCurrentUser.mockRejectedValueOnce(
      new ApiError("Authentication is required.", {
        code: "authentication_required",
        status: 401,
      }),
    );

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );

    await screen.findByText("anonymous");
    expect(screen.getByTestId("auth-state")).not.toHaveTextContent(
      "unavailable",
    );
  });

  it("keeps an unavailable boot distinct from a signed-out session and can retry", async () => {
    const queryClient = createTestQueryClient();
    mockedGetCurrentUser
      .mockRejectedValueOnce(
        new ApiError("Could not reach the GrapeVyne API.", {
          code: "network_error",
        }),
      )
      .mockResolvedValueOnce(testUser);

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );

    expect(
      await screen.findByText("unavailable:Could not reach the GrapeVyne API."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh session" }));
    await screen.findByText("cellar@example.com");
  });

  it("preserves the uncertain boot state when login fails, then clears it on success", async () => {
    const queryClient = createTestQueryClient();
    mockedGetCurrentUser.mockRejectedValueOnce(
      new ApiError("Could not reach the GrapeVyne API.", {
        code: "network_error",
      }),
    );
    mockedLogin
      .mockRejectedValueOnce(
        new ApiError("Invalid email or password.", {
          code: "invalid_credentials",
          status: 401,
        }),
      )
      .mockResolvedValueOnce({
        ...testUser,
        email: "new-session@example.com",
        id: 18,
      });

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("unavailable:Could not reach the GrapeVyne API.");

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(mockedLogin).toHaveBeenCalledTimes(1));
    await screen.findByText("unavailable:Could not reach the GrapeVyne API.");

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("new-session@example.com");
    expect(screen.getByTestId("auth-state")).not.toHaveTextContent(
      "unavailable",
    );
  });

  it("preserves the uncertain boot state when signup fails", async () => {
    const queryClient = createTestQueryClient();
    mockedGetCurrentUser.mockRejectedValueOnce(
      new ApiError("Could not reach the GrapeVyne API.", {
        code: "network_error",
      }),
    );
    mockedSignup.mockRejectedValueOnce(
      new ApiError("Signup validation failed.", {
        code: "validation_error",
        status: 400,
      }),
    );

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("unavailable:Could not reach the GrapeVyne API.");

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(mockedSignup).toHaveBeenCalledOnce());
    await screen.findByText("unavailable:Could not reach the GrapeVyne API.");
  });

  it("revalidates a current owner's expired session and clears private caches", async () => {
    const queryClient = createTestQueryClient();
    mockedGetCurrentUser
      .mockResolvedValueOnce(testUser)
      .mockRejectedValueOnce(
        new ApiError("Authentication is required.", {
          code: "authentication_required",
          status: 401,
        }),
      );

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    act(() => {
      queryClient.setQueryData(
        privateQueryKey(testUser.id, "cellar"),
        ["private bottle"],
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Expire current session" }),
    );

    await screen.findByText("anonymous");
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData(privateQueryKey(testUser.id, "cellar")),
    ).toBeUndefined();
  });

  it("ignores a late expiry report from the previous identity", async () => {
    const queryClient = createTestQueryClient();

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("new-session@example.com");

    fireEvent.click(
      screen.getByRole("button", { name: "Expire old session" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "new-session@example.com",
      );
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledOnce();
  });

  it("aborts the in-flight session boot when the provider unmounts", () => {
    const queryClient = createTestQueryClient();
    let bootSignal: AbortSignal | undefined;
    mockedGetCurrentUser.mockImplementation((signal) => {
      bootSignal = signal;
      return new Promise<User>(() => undefined);
    });

    const view = render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );

    view.unmount();
    expect(bootSignal?.aborted).toBe(true);
  });

  it("removes cross-tab and lifecycle listeners and aborts revalidation on unmount", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const queryClient = createTestQueryClient();
    let revalidationSignal: AbortSignal | undefined;

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");
    mockedGetCurrentUser.mockImplementation((signal) => {
      revalidationSignal = signal;
      return new Promise<User>(() => undefined);
    });

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(revalidationSignal).toBeDefined());

    cleanup();
    expect(revalidationSignal?.aborted).toBe(true);
    expect(FakeBroadcastChannel.instances[0]?.closed).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("focus"));
      FakeBroadcastChannel.instances[0]?.emit({
        action: "logout",
        sequence: 1,
        sourceId: "another-tab",
        type: "grapevyne-auth-session-changed",
        version: 1,
      });
    });
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2);
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

  it("removes the previous identity's private cache before exposing a new login", async () => {
    const queryClient = createTestQueryClient();

    render(
      <TestProviders queryClient={queryClient}>
        <AuthProbe />
      </TestProviders>,
    );
    await screen.findByText("cellar@example.com");

    act(() => {
      queryClient.setQueryData(
        privateQueryKey(testUser.id, "cellar"),
        ["first user's private bottle"],
      );
      queryClient.setQueryData(
        ["public", "wine-search", "pinot"],
        ["public bottle"],
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("new-session@example.com");

    expect(
      queryClient.getQueryData(privateQueryKey(testUser.id, "cellar")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(["public", "wine-search", "pinot"]),
    ).toEqual(["public bottle"]);
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
