import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router-dom";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "text" | "danger";
export type ButtonSize = "compact" | "default";

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function buttonClassName({
  className,
  size = "default",
  variant = "primary",
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}) {
  return joinClassNames(
    "gv-button",
    `gv-button--${variant}`,
    size === "compact" && "gv-button--compact",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busyLabel?: string;
  isBusy?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    busyLabel = "Working…",
    children,
    className,
    disabled,
    isBusy = false,
    size,
    type = "button",
    variant,
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      aria-busy={isBusy || undefined}
      className={buttonClassName({ className, size, variant })}
      data-busy={isBusy || undefined}
      disabled={disabled || isBusy}
      ref={ref}
      type={type}
    >
      {isBusy ? <span aria-hidden="true" className="gv-button__spinner" /> : null}
      <span>{isBusy ? busyLabel : children}</span>
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function ButtonLink({
  children,
  className,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClassName({ className, size, variant })}>
      {children}
    </Link>
  );
}
