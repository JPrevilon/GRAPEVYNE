import { ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";

import WineBottleMark from "./WineBottleMark.jsx";

function formatPrice(priceCents) {
  if (!priceCents) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

function getBottleTone(varietal) {
  const value = varietal?.toLowerCase() || "";

  if (
    value.includes("sauvignon blanc") ||
    value.includes("champagne") ||
    value.includes("blend")
  ) {
    return "gold";
  }

  return "red";
}

export default function WineCard({ wine }) {
  return (
    <article className="wine-card">
      <div className="wine-card__visual">
        {wine.imageUrl ? (
          <img src={wine.imageUrl} alt={`${wine.name} bottle`} />
        ) : (
          <WineBottleMark tone={getBottleTone(wine.varietal)} />
        )}
      </div>

      <div className="wine-card__content">
        <div>
          <p className="wine-card__varietal">{wine.varietal}</p>
          <h2>{wine.name}</h2>
          <p>{wine.winery}</p>
        </div>

        <div className="wine-card__meta">
          <span>
            <MapPin size={15} />
            {wine.region}, {wine.country}
          </span>
          <span>
            <Star size={15} />
            {wine.averageRating?.toFixed(1) || "Unrated"}
          </span>
        </div>

        <p className="wine-card__description">{wine.description}</p>

        <div className="wine-card__footer">
          <span>{formatPrice(wine.priceCents)}</span>
          <Link className="wine-card__link" to={`/wines/${wine.externalWineId}`}>
            Details
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

