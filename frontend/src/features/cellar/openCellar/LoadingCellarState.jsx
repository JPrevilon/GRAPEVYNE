export default function LoadingCellarState() {
  return (
    <section className="oc-loading-state" aria-live="polite" aria-busy="true">
      <div>
        <p className="eyebrow">Opening cellar</p>
        <h1>Gathering your saved bottles.</h1>
        <p>Your private shelves are being arranged by mood, memory, and occasion.</p>
      </div>

      <div className="oc-loading-state__shelves" aria-hidden="true">
        {[0, 1, 2].map((shelf) => (
          <div className="oc-loading-state__shelf" key={shelf}>
            {[0, 1, 2, 3].map((bottle) => (
              <span key={bottle} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
