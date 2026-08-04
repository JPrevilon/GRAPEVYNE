import BrandLockup from "@/components/brand/BrandLockup";

export default function RouteLoading() {
  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="state-panel"
      role="status"
    >
      <BrandLockup className="state-panel__brand" />
      <p className="eyebrow">One moment</p>
      <h1>OPENING GRAPEVYNE</h1>
      <p>Preparing this chapter and checking any session it requires.</p>
    </section>
  );
}
