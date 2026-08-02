import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";

import type { Wine } from "@/types/domain";

import { WineVisual } from "./WineBottleFallback";

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(priceCents / 100);
}

function wineLocation(wine: Wine) {
  return [wine.region, wine.country].filter(Boolean).join(", ");
}

export default function WineCard({ wine }: { wine: Wine }) {
  const detailPath = wine.externalWineId
    ? `/wines/${encodeURIComponent(wine.externalWineId)}`
    : null;
  const location = wineLocation(wine);

  return (
    <article className="gv-wine-card">
      <div className="gv-wine-card__visual">
        <WineVisual
          imageUrl={wine.imageUrl}
          label={wine.name}
          varietal={wine.varietal}
        />
        {wine.vintage ? <span className="gv-wine-card__vintage">{wine.vintage}</span> : null}
      </div>

      <div className="gv-wine-card__body">
        {wine.varietal ? <p className="gv-eyebrow">{wine.varietal}</p> : null}
        <h2>
          {detailPath ? <Link to={detailPath}>{wine.name}</Link> : wine.name}
        </h2>
        {wine.winery ? <p className="gv-wine-card__producer">{wine.winery}</p> : null}
        {wine.description ? (
          <p className="gv-wine-card__description">{wine.description}</p>
        ) : null}

        {location || wine.averageRating !== null || wine.priceCents !== null ? (
          <div className="gv-wine-card__meta">
            {location ? (
              <span>
                <MapPin aria-hidden="true" size={15} />
                {location}
              </span>
            ) : null}
            {wine.averageRating !== null ? (
              <span>
                <Star aria-hidden="true" size={15} />
                {wine.averageRating.toFixed(1)}
              </span>
            ) : null}
            {wine.priceCents !== null ? (
              <strong>{formatPrice(wine.priceCents)}</strong>
            ) : null}
          </div>
        ) : null}

        {detailPath ? (
          <Link aria-label={`View ${wine.name}`} className="gv-wine-card__link" to={detailPath}>
            View bottle
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
