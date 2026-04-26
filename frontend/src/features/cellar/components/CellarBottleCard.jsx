import { Heart, Star } from "lucide-react";

import WineBottleMark from "../../wines/components/WineBottleMark.jsx";

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

export default function CellarBottleCard({ entry, isSelected, onSelect }) {
  return (
    <button
      className={isSelected ? "open-cellar-bottle is-selected" : "open-cellar-bottle"}
      onClick={() => onSelect(entry)}
      type="button"
    >
      <span className="open-cellar-bottle__glow" />
      <span className="open-cellar-bottle__visual">
        {entry.wine.imageUrl ? (
          <img src={entry.wine.imageUrl} alt="" />
        ) : (
          <WineBottleMark tone={getBottleTone(entry.wine.varietal)} />
        )}
      </span>
      <span className="open-cellar-bottle__copy">
        <span className="wine-card__varietal">{entry.wine.varietal}</span>
        <strong>{entry.wine.name}</strong>
        <span>{entry.wine.winery}</span>
      </span>
      <span className="open-cellar-bottle__meta">
        <span>
          <Star size={14} />
          {entry.userRating ? `${entry.userRating}/5` : "unrated"}
        </span>
        {entry.favorite ? (
          <span>
            <Heart size={14} />
            favorite
          </span>
        ) : null}
      </span>
    </button>
  );
}

