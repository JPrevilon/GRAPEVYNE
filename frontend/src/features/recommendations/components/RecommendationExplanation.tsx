import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { RecommendationMatch } from "@/types/domain";

const dimensionLabels = {
  budget: "Budget fit",
  discovery_balance: "Discovery balance",
  occasion: "Occasion fit",
  pairing: "Pairing fit",
  personal_taste: "Personal taste fit",
  requested_style: "Requested style fit",
  source_confidence: "Source-data confidence",
} as const;

const pointFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatPoints(value: number) {
  return pointFormatter.format(value);
}

interface RecommendationExplanationProps {
  headingLevel?: "h3" | "h4";
  match: RecommendationMatch;
  wineName: string;
}

export default function RecommendationExplanation({
  headingLevel = "h3",
  match,
  wineName,
}: RecommendationExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const generatedId = useId();
  const panelId = `recommendation-breakdown-${generatedId.replace(/:/g, "")}`;
  const Heading = headingLevel;

  return (
    <div className="gv-recommendation-explanation">
      <div className="gv-recommendation-score-row">
        <p className="gv-recommendation-score">
          <strong>{match.score}</strong>
          <span>/ 100 match</span>
        </p>
        <dl className="gv-recommendation-basis">
          <div>
            <dt>Confidence</dt>
            <dd>{match.confidence}</dd>
          </div>
          <div>
            <dt>Basis</dt>
            <dd>
              {match.scoreBasis === "personalized"
                ? "Request + cellar signals"
                : "Request only"}
            </dd>
          </div>
        </dl>
      </div>

      {match.reasons.length > 0 ? (
        <section aria-label={`Primary reasons for ${wineName}`}>
          <Heading>Why it ranks</Heading>
          <ul className="gv-recommendation-reasons">
            {match.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {match.cautions.length > 0 ? (
        <section aria-label={`Cautions for ${wineName}`}>
          <Heading>Cautions</Heading>
          <ul className="gv-recommendation-cautions">
            {match.cautions.map((caution) => (
              <li key={caution}>{caution}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button
        aria-controls={panelId}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Hide" : "Show"} full score breakdown for ${wineName}`}
        className="gv-breakdown-toggle"
        onClick={() => setIsExpanded((current) => !current)}
        size="compact"
        variant="text"
      >
        {isExpanded ? "Hide score breakdown" : "Show score breakdown"}
        <ChevronDown aria-hidden="true" size={16} />
      </Button>

      {isExpanded ? (
        <div className="gv-score-breakdown" id={panelId}>
          <p>
            The overall score is earned points divided by available points. An
            unavailable dimension receives neither credit nor denominator weight.
          </p>
          <dl>
            {match.breakdown.map((dimension) => (
              <div key={dimension.dimension}>
                <dt>{dimensionLabels[dimension.dimension]}</dt>
                <dd>
                  <strong>
                    {formatPoints(dimension.earnedPoints)} of{" "}
                    {formatPoints(dimension.availablePoints)} available points
                  </strong>
                  <span>
                    {formatPoints(dimension.normalizedContribution)} points of the
                    normalized 100-point score
                  </span>
                  {dimension.evidence.length > 0 ? (
                    <ul>
                      {dimension.evidence.map((evidence) => (
                        <li key={evidence}>{evidence.replace(/^(MATCH|NO MATCH|UNAVAILABLE):\s*/, "")}</li>
                      ))}
                    </ul>
                  ) : null}
                  {dimension.unavailableReason ? (
                    <span>{dimension.unavailableReason}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          {match.missingDataDisclosures.length > 0 ? (
            <div className="gv-score-breakdown__missing">
              <Heading>Missing-data disclosures</Heading>
              <ul>
                {match.missingDataDisclosures.map((disclosure) => (
                  <li key={disclosure}>{disclosure}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
