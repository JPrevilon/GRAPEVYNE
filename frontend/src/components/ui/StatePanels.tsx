import { AlertCircle, CheckCircle2, CircleEllipsis, Info, Wine } from "lucide-react";
import type { ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3";

interface StatePanelProps {
  action?: ReactNode;
  children?: ReactNode;
  description?: string;
  eyebrow?: string;
  headingLevel?: HeadingLevel;
  icon?: ReactNode;
  role?: "alert" | "status";
  title: string;
  tone: "danger" | "demo" | "info" | "loading" | "success";
}

function StatePanel({
  action,
  children,
  description,
  eyebrow,
  headingLevel = "h2",
  icon,
  role,
  title,
  tone,
}: StatePanelProps) {
  const Heading = headingLevel;

  return (
    <section
      aria-live={role === "alert" ? "assertive" : role === "status" ? "polite" : undefined}
      className={`gv-state-panel gv-state-panel--${tone}`}
      role={role}
    >
      {icon ? <span className="gv-state-panel__icon">{icon}</span> : null}
      <div className="gv-state-panel__content">
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
        {children}
        {action ? <div className="gv-state-panel__action">{action}</div> : null}
      </div>
    </section>
  );
}

export type PublicStatePanelProps = Omit<StatePanelProps, "icon" | "role" | "tone">;

export function LoadingPanel(props: PublicStatePanelProps) {
  return (
    <StatePanel
      {...props}
      icon={<CircleEllipsis aria-hidden="true" size={24} />}
      role="status"
      tone="loading"
    >
      <SkeletonState />
      {props.children}
    </StatePanel>
  );
}

export function EmptyState(props: PublicStatePanelProps) {
  return (
    <StatePanel
      {...props}
      icon={<Wine aria-hidden="true" size={24} />}
      tone="info"
    />
  );
}

export function ErrorPanel(props: PublicStatePanelProps) {
  return (
    <StatePanel
      {...props}
      icon={<AlertCircle aria-hidden="true" size={24} />}
      role="alert"
      tone="danger"
    />
  );
}

interface NoticePanelProps extends PublicStatePanelProps {
  tone?: "demo" | "info" | "success";
}

export function NoticePanel({ tone = "info", ...props }: NoticePanelProps) {
  return (
    <StatePanel
      {...props}
      icon={
        tone === "success" ? (
          <CheckCircle2 aria-hidden="true" size={24} />
        ) : (
          <Info aria-hidden="true" size={24} />
        )
      }
      role={tone === "success" ? "status" : undefined}
      tone={tone}
    />
  );
}

export function SkeletonState({ rows = 3 }: { rows?: number }) {
  return (
    <span aria-hidden="true" className="gv-skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}
