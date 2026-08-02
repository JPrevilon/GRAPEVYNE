import type { ReactNode } from "react";

interface PageHeaderProps {
  children?: ReactNode;
  description?: string;
  eyebrow?: string;
  headingLevel?: "h1" | "h2";
  title: string;
}

export default function PageHeader({
  children,
  description,
  eyebrow,
  headingLevel = "h1",
  title,
}: PageHeaderProps) {
  const Heading = headingLevel;

  return (
    <section className="page-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="page-header__content">
        <div>
          <Heading>{title}</Heading>
          {description ? <p>{description}</p> : null}
        </div>
        {children ? <div className="page-header__aside">{children}</div> : null}
      </div>
    </section>
  );
}
