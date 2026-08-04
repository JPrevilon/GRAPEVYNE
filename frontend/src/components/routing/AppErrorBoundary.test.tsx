import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installSafeDevelopmentConsole } from "@/lib/safeDevelopmentConsole";

import AppErrorBoundary from "./AppErrorBoundary";

function BrokenRoute(): never {
  throw new Error(
    "private-note@example.test PRIVATE FREE-FORM NOTE must never appear in recovery output",
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("shows a visitor-safe recovery view without exposing the thrown value", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restoreConsole = installSafeDevelopmentConsole();
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/broken"]}
      >
        <AppErrorBoundary>
          <Routes>
            <Route path="/broken" element={<BrokenRoute />} />
          </Routes>
        </AppErrorBoundary>
      </MemoryRouter>,
    );
    restoreConsole();

    expect(
      screen.getByRole("heading", { name: "THIS PAGE COULD NOT BE OPENED" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This recovery view does not change saved cellar data/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/private-note@example\.test/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try this page again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "private-note@example.test",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "PRIVATE FREE-FORM NOTE",
    );
    expect(JSON.stringify(consoleError.mock.calls)).toContain(
      "raw error details were withheld",
    );
  });

  it("resets after navigation so visitors can recover without fabricated state", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/broken"]}
      >
        <AppErrorBoundary>
          <Routes>
            <Route path="/broken" element={<BrokenRoute />} />
            <Route path="/" element={<h1>Safe route</h1>} />
          </Routes>
        </AppErrorBoundary>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Return home" }));
    expect(screen.getByRole("heading", { name: "Safe route" })).toBeInTheDocument();
  });
});
