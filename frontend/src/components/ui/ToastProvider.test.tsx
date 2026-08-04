import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ToastProvider } from "./ToastProvider.jsx";
import { useToast } from "./useToast.js";

function ToastHarness() {
  const { clearToasts, showToast } = useToast();

  return (
    <div>
      <button
        onClick={() =>
          showToast({
            message: "The bottle was saved after the cellar confirmed it.",
            title: "Saved to cellar",
          })
        }
        type="button"
      >
        Show success
      </button>
      <button
        onClick={() =>
          showToast({
            message: "The cellar API could not save this bottle.",
            title: "Save failed",
            tone: "error",
          })
        }
        type="button"
      >
        Show error
      </button>
      <button onClick={clearToasts} type="button">
        Clear notifications
      </button>
    </div>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

afterEach(cleanup);

describe("ToastProvider", () => {
  it("announces successful feedback as an atomic status", () => {
    renderToasts();

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Saved to cellar");
    expect(status).toHaveTextContent(
      "The bottle was saved after the cellar confirmed it.",
    );
    expect(
      within(status).getByRole("button", { name: "Dismiss notification" }),
    ).toBeInTheDocument();
  });

  it("announces error feedback as an atomic alert", () => {
    renderToasts();

    fireEvent.click(screen.getByRole("button", { name: "Show error" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-atomic", "true");
    expect(alert).toHaveTextContent("Save failed");
    expect(alert).toHaveTextContent("The cellar API could not save this bottle.");
  });

  it("dismisses only the notification whose accessible close control is used", () => {
    renderToasts();
    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    fireEvent.click(screen.getByRole("button", { name: "Show error" }));

    const status = screen.getByRole("status");
    const alert = screen.getByRole("alert");
    fireEvent.click(
      within(status).getByRole("button", { name: "Dismiss notification" }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
  });

  it("clears every notification and its dismissal timer", () => {
    renderToasts();
    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    fireEvent.click(screen.getByRole("button", { name: "Show error" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Clear notifications" }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
