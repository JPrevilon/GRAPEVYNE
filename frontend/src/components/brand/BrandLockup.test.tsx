import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BrandLockup from "./BrandLockup";

describe("BrandLockup", () => {
  afterEach(cleanup);

  it("uses the approved decorative monogram with an accessible live-text identity", () => {
    const { container } = render(<BrandLockup />);

    expect(screen.getByText("GRAPEVYNE")).toBeInTheDocument();
    expect(screen.getByText("PRIVATE WINE DIRECTORY")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/brand/grapevyne-monogram.svg",
    );
    expect(container.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(container.querySelector("[src*='wordmark']")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
