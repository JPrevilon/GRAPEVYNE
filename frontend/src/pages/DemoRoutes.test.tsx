import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DemoCellarPage from "./DemoCellarPage";
import DemoTasteAtlasPage from "./DemoTasteAtlasPage";

const cellarApi = vi.hoisted(() => ({
  deleteCellarEntry: vi.fn(),
  getCellarEntries: vi.fn(),
  getCellarEntry: vi.fn(),
  saveWineToCellar: vi.fn(),
  updateCellarEntry: vi.fn(),
}));

vi.mock("@/api/cellar", () => cellarApi);

function renderDemo(page: "atlas" | "cellar") {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      {page === "cellar" ? <DemoCellarPage /> : <DemoTasteAtlasPage />}
    </MemoryRouter>,
  );
}

function expectRealProductCtas() {
  expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/signup",
  );
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(screen.getByRole("link", { name: /Begin real discovery/i })).toHaveAttribute(
    "href",
    "/discover",
  );
}

function expectNoPrivateCellarCalls() {
  Object.values(cellarApi).forEach((apiCall) => {
    expect(apiCall).not.toHaveBeenCalled();
  });
}

beforeEach(() => {
  Object.values(cellarApi).forEach((apiCall) => apiCall.mockReset());
});

afterEach(cleanup);

describe("public demonstration routes", () => {
  it("keeps the demo cellar visibly fictional and read-only through interaction", () => {
    renderDemo("cellar");

    expect(screen.getByText("Public demonstration · Read-only")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /A cellar designed around the moments bottles join/i,
      }),
    ).toBeInTheDocument();
    expectRealProductCtas();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /save|favorite|edit|delete|remove|rate/i,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Estate Cabernet Sauvignon/i,
      }),
    );

    expect(screen.getByText("Read-only demo detail")).toBeInTheDocument();
    expect(
      screen.getByText(/not associated with you and cannot be edited here/i),
    ).toBeInTheDocument();
    expectNoPrivateCellarCalls();
  });

  it("keeps the demo Taste Atlas explicitly fixture-derived and links to real routes", () => {
    renderDemo("atlas");

    expect(screen.getByText("Public demonstration · Read-only")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /A Taste Atlas made from fixture data alone/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not query a profile endpoint, predict your taste, or read authenticated cellar data/i),
    ).toBeInTheDocument();
    expectRealProductCtas();
    expect(
      screen.queryByRole("button", {
        name: /save|favorite|edit|delete|remove|rate/i,
      }),
    ).not.toBeInTheDocument();
    expectNoPrivateCellarCalls();
  });
});
