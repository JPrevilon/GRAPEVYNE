import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { WineVisual } from "@/components/wine/WineBottleFallback";
import SaveWineControl from "@/features/cellar/components/SaveWineControl";
import type { RecommendationResult } from "@/types/domain";

import RecommendationExplanation from "./RecommendationExplanation";

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(priceCents / 100);
}

interface RecommendationResultCardProps {
  index: number;
  query: string;
  result: RecommendationResult;
}

export default function RecommendationResultCard({
  index,
  query,
  result,
}: RecommendationResultCardProps) {
  const { match, wine } = result;
  const location = [wine.region, wine.country].filter(Boolean).join(", ");
  const detailPath = wine.externalWineId
    ? `/wines/${encodeURIComponent(wine.externalWineId)}?${new URLSearchParams({ request: query })}`
    : null;

  return (
    <article className="gv-recommendation-card">
      <span aria-hidden="true" className="gv-recommendation-card__index">
        {String(index).padStart(2, "0")}
      </span>

      <div className="gv-recommendation-card__visual">
        <WineVisual
          imageUrl={wine.imageUrl}
          label={wine.name}
          varietal={wine.varietal}
        />
        {wine.vintage ? (
          <span className="gv-wine-card__vintage">{wine.vintage}</span>
        ) : null}
      </div>

      <div className="gv-recommendation-card__copy">
        <p className="gv-eyebrow">EXPLAINABLE CATALOG MATCH</p>
        <h3>{detailPath ? <Link to={detailPath}>{wine.name}</Link> : wine.name}</h3>
        {wine.winery ? (
          <p className="gv-wine-card__producer">{wine.winery}</p>
        ) : null}
        <dl className="gv-recommendation-card__facts">
          {location ? (
            <div>
              <dt>
                <MapPin aria-hidden="true" size={15} /> Origin
              </dt>
              <dd>{location}</dd>
            </div>
          ) : null}
          {wine.varietal ? (
            <div>
              <dt>Varietal</dt>
              <dd>{wine.varietal}</dd>
            </div>
          ) : null}
          {wine.priceCents !== null ? (
            <div>
              <dt>Listed price</dt>
              <dd>{formatPrice(wine.priceCents)}</dd>
            </div>
          ) : null}
          {wine.averageRating !== null ? (
            <div>
              <dt>
                <Star aria-hidden="true" size={15} /> Catalog rating
              </dt>
              <dd>{wine.averageRating.toFixed(1)}</dd>
            </div>
          ) : null}
        </dl>

        <RecommendationExplanation
          headingLevel="h4"
          match={match}
          wineName={wine.name}
        />

        <div className="gv-recommendation-card__actions">
          {detailPath ? (
            <Link
              aria-label={`View ${wine.name} with recommendation context`}
              className="gv-wine-card__link"
              to={detailPath}
            >
              View bottle
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
          <SaveWineControl wine={wine} />
        </div>
      </div>
    </article>
  );
}
