import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  children: ReactNode;
  isBusy?: boolean;
  tone?: "default" | "quiet";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      className = "",
      disabled,
      isBusy = false,
      tone = "default",
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        aria-busy={isBusy || undefined}
        className={`gv-icon-button gv-icon-button--${tone} ${className}`.trim()}
        disabled={disabled || isBusy}
        ref={ref}
        type={type}
      >
        {children}
      </button>
    );
  },
);
