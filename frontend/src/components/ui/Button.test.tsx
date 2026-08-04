import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, ButtonLink, type ButtonVariant } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("uses native disabled semantics and cannot invoke its action", () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Save bottle
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save bottle" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("aria-busy");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("announces its busy label, disables activation, and hides its spinner", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button busyLabel="Saving bottle…" isBusy onClick={onClick}>
        Save bottle
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving bottle…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-busy", "true");
    expect(container.querySelector(".gv-button__spinner")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.queryByText("Save bottle")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each<ButtonVariant>(["primary", "secondary", "ghost", "text", "danger"])(
    "maps the %s variant to the shared design-system class",
    (variant) => {
      render(<Button variant={variant}>{variant} action</Button>);

      expect(
        screen.getByRole("button", { name: `${variant} action` }),
      ).toHaveClass("gv-button", `gv-button--${variant}`);
    },
  );

  it("keeps link actions semantic while sharing compact variant styling", () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <ButtonLink size="compact" to="/discover" variant="ghost">
          Discover wines
        </ButtonLink>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Discover wines" });
    expect(link).toHaveAttribute("href", "/discover");
    expect(link).toHaveClass(
      "gv-button",
      "gv-button--ghost",
      "gv-button--compact",
    );
  });
});
