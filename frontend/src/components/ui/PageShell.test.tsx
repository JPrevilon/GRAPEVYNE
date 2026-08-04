import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DirectoryHeading from "@/components/typography/DirectoryHeading";

import { PageShell } from "./PageShell";

describe("PageShell", () => {
  afterEach(cleanup);

  it("accepts a composed route heading without nesting semantic headings", () => {
    const { container } = render(
      <PageShell
        actions={<button type="button">Search catalog</button>}
        description="Search the current directory."
        eyebrow="01 / DIRECTORY"
        heading={
          <DirectoryHeading
            ariaLabel="DISCOVER WINES"
            segments={[
              { row: 1, size: "small", text: "DISCOVER", weight: "light" },
              { row: 2, size: "large", text: "WINES", weight: "regular" },
            ]}
          />
        }
      >
        <p>Directory content</p>
      </PageShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "DISCOVER WINES" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1 h1, h1 h2")).not.toBeInTheDocument();
    expect(screen.getByText("01 / DIRECTORY")).toBeInTheDocument();
    expect(screen.getByText("Search the current directory.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search catalog" })).toBeInTheDocument();
    expect(screen.getByText("Directory content")).toBeInTheDocument();
  });
});
