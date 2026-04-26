export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <section className="page-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="page-header__content">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {children ? <div className="page-header__aside">{children}</div> : null}
      </div>
    </section>
  );
}

