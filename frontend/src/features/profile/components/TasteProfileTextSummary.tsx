import type {
  TasteProfile,
  TasteSignal,
  TasteSignalDimension,
} from "@/types/domain";
import { TASTE_DIMENSION_LABELS } from "@/features/profile/tasteProfilePresentation";

function signalsByDimension(signals: readonly TasteSignal[]) {
  return (Object.keys(TASTE_DIMENSION_LABELS) as TasteSignalDimension[])
    .map((dimension) => ({
      dimension,
      signals: signals.filter((signal) => signal.dimension === dimension),
    }))
    .filter((group) => group.signals.length > 0);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export default function TasteProfileTextSummary({ profile }: { profile: TasteProfile }) {
  const groups = signalsByDimension(profile.signals);

  return (
    <section aria-labelledby="taste-text-summary-title" className="gv-taste-text-summary">
      <header>
        <p className="gv-eyebrow">Readable Atlas</p>
        <h2 id="taste-text-summary-title">THE SAME PATTERNS, IN TEXT</h2>
        <p>Every major visual signal is repeated here without relying on position, size, or color.</p>
      </header>

      <dl className="gv-taste-evidence">
        <div><dt>Cellar entries considered</dt><dd>{profile.evidence.totalCellarEntries}</dd></div>
        <div><dt>Meaningful entries</dt><dd>{profile.evidence.meaningfulEntries}</dd></div>
        <div><dt>Distinct sourced wines</dt><dd>{profile.evidence.distinctCanonicalWines}</dd></div>
        <div><dt>Preference signals</dt><dd>{profile.evidence.signalCount}</dd></div>
      </dl>

      {groups.length > 0 ? (
        <div className="gv-taste-text-summary__groups">
          {groups.map(({ dimension, signals }) => (
            <section key={dimension}>
              <h3>{TASTE_DIMENSION_LABELS[dimension]}</h3>
              <ul>
                {signals.map((signal) => (
                  <li key={signal.id}>
                    <strong>{signal.label}</strong>
                    <span>{signal.summary}</span>
                    <small>{signal.evidenceCount} supporting {signal.evidenceCount === 1 ? "bottle" : "bottles"}</small>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {profile.observedPriceRange ? (
        <p className="gv-taste-price-range">
          <strong>Observed sourced price range:</strong>{" "}
          {formatMoney(profile.observedPriceRange.minimumCents)}–{formatMoney(profile.observedPriceRange.maximumCents)} across {profile.observedPriceRange.sampleSize} priced {profile.observedPriceRange.sampleSize === 1 ? "record" : "records"}.
        </p>
      ) : null}

      {profile.lowerAffinitySignals.length > 0 ? (
        <section className="gv-taste-lower-affinity" aria-labelledby="taste-lower-affinity-title">
          <h3 id="taste-lower-affinity-title">EARLY LOWER-AFFINITY SIGNALS</h3>
          <p>These are cautious observations from recorded behavior, not permanent conclusions.</p>
          <ul>
            {profile.lowerAffinitySignals.map((signal) => (
              <li key={signal.id}><strong>{signal.label}</strong> — {signal.summary}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
