import type { ReactNode } from "react";

interface SidePanelProps {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}

export function SidePanel({
  children,
  className = "",
  id,
  labelledBy,
}: SidePanelProps) {
  return (
    <aside
      aria-labelledby={labelledBy}
      className={`gv-side-panel ${className}`.trim()}
      id={id}
    >
      {children}
    </aside>
  );
}
