import WineCard from "./WineCard.jsx";

export default function WineResultsGrid({ query, results }) {
  if (!results.length) {
    return (
      <section className="state-panel state-panel--compact">
        <p className="eyebrow">No matches</p>
        <h1>No bottle surfaced for that search.</h1>
        <p>
          Try a varietal, region, food pairing, or occasion. Good starting
          points include steak, salmon, champagne, Tuscany, Napa, and gift.
        </p>
      </section>
    );
  }

  return (
    <section className="wine-results" aria-label={`Wine results for ${query}`}>
      <div className="section-heading">
        <p className="eyebrow">Results</p>
        <h2>{results.length} curated match{results.length === 1 ? "" : "es"}</h2>
      </div>
      <div className="wine-results__grid">
        {results.map((wine) => (
          <WineCard key={wine.externalWineId} wine={wine} />
        ))}
      </div>
    </section>
  );
}
