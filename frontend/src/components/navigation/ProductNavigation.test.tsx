import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/components/ui/useToast.js";
import { useAuth } from "@/features/auth/useAuth";
import type { User } from "@/types/domain";

import ProductNavigation from "./ProductNavigation";

interface ToastValue {
  dismissToast: (id: string) => void;
  showToast: (toast: {
    message: string;
    title: string;
    tone?: "error" | "success";
  }) => void;
}

vi.mock("@/components/ui/useToast.js", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseToast = vi.mocked(useToast) as unknown as {
  mockReturnValue: (value: ToastValue) => void;
};
const logout = vi.fn<() => Promise<void>>();
const showToast = vi.fn();
const testUser: User = {
  createdAt: "2026-01-02T03:04:05+00:00",
  email: "cellar@example.com",
  id: 17,
  name: "Cellar Owner",
  updatedAt: "2026-01-02T03:04:05+00:00",
};

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
}

function renderNavigation(initialPath = "/") {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialPath]}
    >
      <ProductNavigation />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function useAnonymousSession() {
  mockedUseAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout,
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user: null,
  });
}

function useAuthenticatedSession() {
  mockedUseAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout,
    refreshUser: vi.fn(),
    signup: vi.fn(),
    status: "ready",
    user: testUser,
  });
}

function openDrawer() {
  const trigger = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(trigger);

  return {
    dialog: screen.getByRole("dialog", { name: "Menu" }),
    trigger,
  };
}

describe("ProductNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logout.mockResolvedValue(undefined);
    mockedUseToast.mockReturnValue({
      dismissToast: vi.fn(),
      showToast,
    });
    useAnonymousSession();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens the modal drawer, focuses Close, contains body scroll, and restores both on close", () => {
    document.body.style.overflow = "clip";
    renderNavigation();

    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const { dialog } = openDrawer();
    const closeButton = within(dialog).getByRole("button", { name: "Close" });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("clip");
  });

  it("closes on Escape and restores focus to the menu trigger", () => {
    renderNavigation();
    const { trigger } = openDrawer();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps forward and reverse Tab movement inside the drawer", () => {
    renderNavigation();
    const { dialog } = openDrawer();
    const closeButton = within(dialog).getByRole("button", { name: "Close" });
    const lastLink = within(dialog).getByRole("link", { name: "Signup" });

    lastLink.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastLink).toHaveFocus();
  });

  it("closes the drawer when a route link is followed", () => {
    renderNavigation();
    const { dialog } = openDrawer();

    fireEvent.click(within(dialog).getByRole("link", { name: "Discover" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("uses the real logout contract, closes the drawer, reports success, and navigates home", async () => {
    useAuthenticatedSession();
    renderNavigation("/cellar");
    const { dialog } = openDrawer();

    fireEvent.click(within(dialog).getByRole("button", { name: "Logout" }));

    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/"),
    );
    expect(showToast).toHaveBeenCalledWith({
      message: "Your private cellar is closed.",
      title: "Signed out",
    });
  });
});
