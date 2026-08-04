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

interface WineCardProps {
  index?: number;
  wine: Wine;
}

export default function WineCard({ index, wine }: WineCardProps) {
  const detailPath = wine.externalWineId
    ? `/wines/${encodeURIComponent(wine.externalWineId)}`
    : null;
  const location = wineLocation(wine);

  return (
    <article className="gv-wine-card">
      {index ? (
        <span aria-hidden="true" className="gv-wine-card__index">
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      <div className="gv-wine-card__visual">
        <WineVisual
          imageUrl={wine.imageUrl}
          label={wine.name}
          varietal={wine.varietal}
        />
        {wine.vintage ? <span className="gv-wine-card__vintage">{wine.vintage}</span> : null}
      </div>

      <div className="gv-wine-card__body">
        <p className="gv-eyebrow">CATALOG RECORD</p>
        <h2>
          {detailPath ? <Link to={detailPath}>{wine.name}</Link> : wine.name}
        </h2>
        {wine.winery ? <p className="gv-wine-card__producer">{wine.winery}</p> : null}
        {wine.description ? (
          <p className="gv-wine-card__description">{wine.description}</p>
        ) : null}

        {location || wine.varietal || wine.vintage || wine.averageRating !== null || wine.priceCents !== null ? (
          <dl className="gv-wine-card__meta">
            {location ? (
              <div>
                <dt><MapPin aria-hidden="true" size={15} />ORIGIN</dt>
                <dd>{location}</dd>
              </div>
            ) : null}
            {wine.varietal ? (
              <div>
                <dt>VARIETAL</dt>
                <dd>{wine.varietal}</dd>
              </div>
            ) : null}
            {wine.vintage ? (
              <div>
                <dt>VINTAGE</dt>
                <dd>{wine.vintage}</dd>
              </div>
            ) : null}
            {wine.averageRating !== null ? (
              <div>
                <dt><Star aria-hidden="true" size={15} />RATING</dt>
                <dd>{wine.averageRating.toFixed(1)}</dd>
              </div>
            ) : null}
            {wine.priceCents !== null ? (
              <div>
                <dt>PRICE</dt>
                <dd>{formatPrice(wine.priceCents)}</dd>
              </div>
            ) : null}
          </dl>
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
