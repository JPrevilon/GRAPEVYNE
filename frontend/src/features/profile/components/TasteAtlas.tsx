import { ArrowRight, Compass } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { TASTE_DIMENSION_LABELS } from "@/features/profile/tasteProfilePresentation";
import type { TasteProfile, TasteSignal } from "@/types/domain";

import TasteProfileTextSummary from "./TasteProfileTextSummary";

function nodeStyle(signal: TasteSignal): CSSProperties {
  const boundedScore = Math.min(100, Math.max(0, signal.score));

  return {
    "--taste-node-size": `${3.1 + boundedScore * 0.035}rem`,
  } as CSSProperties;
}

export default function TasteAtlas({ profile }: { profile: TasteProfile }) {
  const [selectedSignalId, setSelectedSignalId] = useState(
    profile.signals[0]?.id ?? "",
  );
  const selectedSignal = useMemo(
    () =>
      profile.signals.find((signal) => signal.id === selectedSignalId) ??
      profile.signals[0] ??
      null,
    [profile.signals, selectedSignalId],
  );

  return (
    <>
      <section aria-labelledby="taste-atlas-title" className="gv-taste-atlas">
        <header>
          <p className="gv-eyebrow">Deterministic Taste Atlas</p>
          <h2 id="taste-atlas-title">YOUR RECORDED BRANCHES</h2>
          <p>Node size reflects aggregate signal strength; labels and shapes preserve meaning without color.</p>
        </header>

        {profile.signals.length > 0 ? (
          <div className="gv-taste-atlas__layout">
            <div
              aria-label="Taste Atlas preference clusters"
              className="gv-taste-atlas__plot"
              role="group"
            >
              {profile.signals.map((signal) => (
                <button
                  aria-label={`${signal.label}, ${TASTE_DIMENSION_LABELS[signal.dimension]}, strength ${signal.score} out of 100, ${signal.evidenceCount} supporting ${signal.evidenceCount === 1 ? "bottle" : "bottles"}`}
                  aria-pressed={selectedSignal?.id === signal.id}
                  className={`gv-taste-node gv-taste-node--${signal.dimension}`}
                  key={signal.id}
                  onClick={() => setSelectedSignalId(signal.id)}
                  onFocus={() => setSelectedSignalId(signal.id)}
                  style={nodeStyle(signal)}
                  type="button"
                >
                  <span aria-hidden="true" />
                  <strong>{signal.label}</strong>
                  <small>{TASTE_DIMENSION_LABELS[signal.dimension]}</small>
                </button>
              ))}
            </div>

            <aside aria-live="polite" className="gv-taste-atlas__selection">
              <Compass aria-hidden="true" size={22} />
              <p className="gv-eyebrow">Selected observed signal</p>
              {selectedSignal ? (
                <>
                  <h3>{selectedSignal.label}</h3>
                  <p>{selectedSignal.summary}</p>
                  <dl>
                    <div><dt>Dimension</dt><dd>{TASTE_DIMENSION_LABELS[selectedSignal.dimension]}</dd></div>
                    <div><dt>Strength</dt><dd>{selectedSignal.score} / 100</dd></div>
                    <div><dt>Evidence</dt><dd>{selectedSignal.evidenceCount}</dd></div>
                  </dl>
                </>
              ) : null}
            </aside>
          </div>
        ) : null}
      </section>

      <TasteProfileTextSummary profile={profile} />

      {profile.adjacentSuggestion ? (
        <section aria-labelledby="taste-adjacent-title" className="gv-taste-adjacent">
          <div>
            <p className="gv-eyebrow">One adjacent branch</p>
            <h2 id="taste-adjacent-title">{profile.adjacentSuggestion.wine.name}</h2>
            <p>
              {[profile.adjacentSuggestion.wine.varietal, profile.adjacentSuggestion.wine.region, profile.adjacentSuggestion.wine.country]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ul>
            {profile.adjacentSuggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <p className="gv-story-disclosure">{profile.adjacentSuggestion.disclosure}</p>
          <ButtonLink
            to={`/wines/${encodeURIComponent(profile.adjacentSuggestion.wine.externalWineId)}`}
            variant="primary"
          >
            View this catalog wine <ArrowRight aria-hidden="true" size={17} />
          </ButtonLink>
        </section>
      ) : null}
    </>
  );
}
