import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";

const mocks = vi.hoisted(() => ({
  auth: {
    error: null as Error | null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    status: "ready" as "error" | "loading" | "ready",
    signup: vi.fn(),
  },
  showToast: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/components/ui/useToast.js", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

const TEST_USER = {
  createdAt: null,
  email: "reader@example.com",
  id: 41,
  name: "Cellar Reader",
  updatedAt: null,
};

interface InitialEntry {
  pathname: string;
  state?: unknown;
}

function LocationProbe() {
  const location = useLocation();

  return (
    <output data-testid="destination">
      {`${location.pathname}${location.search}${location.hash}`}
    </output>
  );
}

function renderAuthRoutes(initialEntry: InitialEntry | string) {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<SignupPage />} path="/signup" />
        <Route element={<LocationProbe />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-password" },
  });
}

function fillSignupForm(password = "secure-password") {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Cellar Reader" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

beforeEach(() => {
  mocks.auth.error = null;
  mocks.auth.isAuthenticated = false;
  mocks.auth.isLoading = false;
  mocks.auth.status = "ready";
  mocks.auth.login.mockReset();
  mocks.auth.signup.mockReset();
  mocks.showToast.mockReset();
});

afterEach(cleanup);

describe("AuthForm", () => {
  it("reports an unavailable session boot without treating it as signed out", () => {
    mocks.auth.error = new Error("Could not reach the GrapeVyne API.");
    mocks.auth.status = "error";
    renderAuthRoutes("/login");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Session check unavailable: Could not reach the GrapeVyne API.",
    );
    expect(screen.getByRole("form", { name: "Sign in form" })).toHaveAccessibleDescription(
      /Session check unavailable/i,
    );
  });

  it("provides accessible login labels and browser autocomplete contracts", () => {
    renderAuthRoutes("/login");

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("name", "password");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Enter the password for your GRAPEVYNE account.",
    );
  });

  it("provides signup field names, autocomplete, and the eight-character description", () => {
    renderAuthRoutes("/signup");

    expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Name")).toHaveAttribute("name", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Use at least 8 characters.",
    );
  });

  it("renders client login validation as an alert without calling the backend", () => {
    renderAuthRoutes("/login");

    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");
    expect(mocks.auth.login).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: "Email is required.",
      title: "Check the form",
      tone: "error",
    });
  });

  it("preserves signup password validation without calling the backend", () => {
    renderAuthRoutes("/signup");
    fillSignupForm("short");

    fireEvent.submit(screen.getByRole("form", { name: "Create account form" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters.",
    );
    expect(mocks.auth.signup).not.toHaveBeenCalled();
  });

  it("renders the backend login message and restores controls after failure", async () => {
    mocks.auth.login.mockRejectedValue({
      details: { credentials: "The email or password is incorrect." },
      message: "Invalid credentials.",
    });
    renderAuthRoutes("/login");
    fillLoginForm();

    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email or password is incorrect.",
    );
    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.showToast).toHaveBeenLastCalledWith({
      message: "The email or password is incorrect.",
      title: "Sign in failed",
      tone: "error",
    });
  });

  it("renders the backend signup message without exposing extra account state", async () => {
    mocks.auth.signup.mockRejectedValue({
      message: "An account with that email already exists.",
    });
    renderAuthRoutes("/signup");
    fillSignupForm();

    fireEvent.submit(screen.getByRole("form", { name: "Create account form" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with that email already exists.",
    );
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("does not report a superseded authentication request as a login failure", async () => {
    mocks.auth.login.mockRejectedValue(
      new DOMException("The request was superseded.", "AbortError"),
    );
    renderAuthRoutes("/login");
    fillLoginForm();

    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("disables every login field and exposes a busy state until login resolves", async () => {
    let resolveLogin: (value: typeof TEST_USER) => void = () => undefined;
    const pendingLogin = new Promise<typeof TEST_USER>((resolve) => {
      resolveLogin = resolve;
    });

    mocks.auth.login.mockReturnValue(pendingLogin);
    renderAuthRoutes({
      pathname: "/login",
      state: { from: "/wines/source-wine-17?pairing=steak#save" },
    });
    fillLoginForm();

    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(screen.getByRole("form", { name: "Sign in form" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();

    resolveLogin(TEST_USER);
    expect(await screen.findByTestId("destination")).toHaveTextContent(
      "/wines/source-wine-17?pairing=steak#save",
    );
  });

  it("keeps controls disabled while the existing session is being checked", () => {
    mocks.auth.isLoading = true;
    renderAuthRoutes("/signup");

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Checking session…" }),
    ).toBeDisabled();
  });

  it("preserves the complete return state through the login-to-signup link", async () => {
    mocks.auth.signup.mockResolvedValue(TEST_USER);
    renderAuthRoutes({
      pathname: "/login",
      state: { from: "/wines/mock-rioja?meal=lamb#save" },
    });

    fireEvent.click(screen.getByRole("link", { name: "Create an account" }));
    expect(
      screen.getByRole("heading", { name: "CREATE YOUR CELLAR" }),
    ).toBeInTheDocument();

    fillSignupForm();
    fireEvent.submit(screen.getByRole("form", { name: "Create account form" }));

    expect(await screen.findByTestId("destination")).toHaveTextContent(
      "/wines/mock-rioja?meal=lamb#save",
    );
    expect(mocks.auth.signup).toHaveBeenCalledWith({
      email: "reader@example.com",
      name: "Cellar Reader",
      password: "secure-password",
    });
  });

  it("redirects an already authenticated visitor to a safe Location return object", async () => {
    mocks.auth.isAuthenticated = true;
    renderAuthRoutes({
      pathname: "/login",
      state: {
        from: {
          hash: "#account",
          pathname: "/profile",
          search: "?view=private",
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("destination")).toHaveTextContent(
        "/profile?view=private#account",
      );
    });
    expect(mocks.auth.login).not.toHaveBeenCalled();
  });
});
