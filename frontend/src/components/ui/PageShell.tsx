import type { ReactNode } from "react";

interface PageShellProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  heading?: ReactNode;
  title?: ReactNode;
}

export function PageShell({
  actions,
  children,
  className = "",
  description,
  eyebrow,
  heading,
  title,
}: PageShellProps) {
  return (
    <div className={`gv-page-shell ${className}`.trim()}>
      {heading || title ? (
        <PageHero
          actions={actions}
          description={description}
          eyebrow={eyebrow}
          heading={heading}
          title={title}
        />
      ) : null}
      {children}
    </div>
  );
}

interface PageHeroProps {
  actions?: ReactNode;
  aside?: ReactNode;
  description?: string;
  eyebrow?: string;
  heading?: ReactNode;
  title?: ReactNode;
}

export function PageHero({
  actions,
  aside,
  description,
  eyebrow,
  heading,
  title,
}: PageHeroProps) {
  return (
    <header className="gv-page-hero">
      <div className="gv-page-hero__copy">
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        {heading ?? <h1>{title}</h1>}
        {description ? <p className="gv-page-hero__lede">{description}</p> : null}
        {actions ? <div className="gv-page-hero__actions">{actions}</div> : null}
      </div>
      {aside ? <div className="gv-page-hero__aside">{aside}</div> : null}
    </header>
  );
}

interface SectionHeadingProps {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  id?: string;
  title: ReactNode;
}

export function SectionHeading({
  actions,
  description,
  eyebrow,
  id,
  title,
}: SectionHeadingProps) {
  return (
    <header className="gv-section-heading">
      <div>
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="gv-section-heading__actions">{actions}</div> : null}
    </header>
  );
}
