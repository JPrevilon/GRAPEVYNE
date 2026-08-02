export default function RouteLoading() {
  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="state-panel"
      role="status"
    >
      <img
        alt=""
        aria-hidden="true"
        className="state-panel__mark"
        src="/assets/brand/grapevyne-monogram.svg"
      />
      <p className="eyebrow">One moment</p>
      <h1>Opening GRAPEVYNE.</h1>
      <p>Preparing this chapter and checking any session it requires.</p>
    </section>
  );
}
