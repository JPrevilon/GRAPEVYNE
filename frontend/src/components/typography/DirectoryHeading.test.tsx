import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DirectoryHeading from "./DirectoryHeading";

describe("DirectoryHeading", () => {
  afterEach(cleanup);

  it("exposes one coherent hero heading while keeping visual segments decorative", () => {
    const { container } = render(
      <DirectoryHeading
        ariaLabel="FIND THE BOTTLE KEEP THE MEMORY"
        scale="hero"
        segments={[
          { row: 1, size: "small", text: "FIND THE", weight: "light" },
          { row: 1, size: "large", text: "BOTTLE", weight: "regular" },
          { row: 2, size: "micro", text: "KEEP THE", weight: "light" },
          {
            accent: true,
            row: 2,
            size: "medium",
            text: "MEMORY",
            weight: "regular",
          },
        ]}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "FIND THE BOTTLE KEEP THE MEMORY",
    });
    const segments = heading.querySelectorAll(".gv-directory-heading__segment");

    expect(container.querySelectorAll("h1, h2")).toHaveLength(1);
    expect(heading.querySelector("h1, h2")).not.toBeInTheDocument();
    expect(heading.querySelector(".gv-directory-heading__visual")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(Array.from(segments, (segment) => segment.textContent?.trim())).toEqual([
      "FIND THE",
      "BOTTLE",
      "KEEP THE",
      "MEMORY",
    ]);
    expect(segments[0]).toHaveClass(
      "gv-directory-heading__segment--size-small",
      "gv-directory-heading__segment--weight-light",
    );
    expect(segments[1]).toHaveClass(
      "gv-directory-heading__segment--size-large",
      "gv-directory-heading__segment--weight-regular",
    );
    expect(segments[2]).toHaveClass("gv-directory-heading__segment--size-micro");
    expect(segments[3]).toHaveClass(
      "gv-directory-heading__segment--size-medium",
      "gv-directory-heading__segment--accent",
    );
  });

  it("supports an h2, medium weight, and finite placement hooks", () => {
    render(
      <DirectoryHeading
        ariaLabel="TASTE TAKES SHAPE"
        as="h2"
        scale="chapter"
        segments={[
          { row: 1, size: "small", text: "TASTE", weight: "light" },
          {
            placement: "inset",
            row: 2,
            size: "large",
            text: "TAKES SHAPE",
            weight: "medium",
          },
        ]}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "TASTE TAKES SHAPE",
    });
    const focalSegment = heading.querySelectorAll(
      ".gv-directory-heading__segment",
    )[1];

    expect(heading).toHaveClass("gv-directory-heading--chapter");
    expect(heading.querySelectorAll("[data-row]")).toHaveLength(2);
    expect(focalSegment).toHaveClass(
      "gv-directory-heading__segment--weight-medium",
      "gv-directory-heading__segment--placement-inset",
    );
  });
});
