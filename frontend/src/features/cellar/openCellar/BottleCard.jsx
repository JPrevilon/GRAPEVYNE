import { Heart, Sparkles, Star } from "lucide-react";

import WineBottleMark from "../../wines/components/WineBottleMark.jsx";

function getBottleTone(entry) {
  const value = `${entry.type || ""} ${entry.style || ""}`.toLowerCase();

  if (
    value.includes("white") ||
    value.includes("sparkling") ||
    value.includes("champagne") ||
    value.includes("sauvignon")
  ) {
    return "gold";
  }

  return "red";
}

export default function BottleCard({ entry, index = 0, isSelected, onSelect }) {
  const vintage = entry.vintage || "NV";
  const rating = entry.personalRating ? `${entry.personalRating}/5` : "Unrated";
  const location = entry.region || entry.country || "cellar";

  return (
    <button
      aria-label={`${entry.wineName}, ${entry.winery}, ${vintage}, ${rating}, ${location}`}
      aria-pressed={isSelected}
      className={isSelected ? "oc-bottle-card is-selected" : "oc-bottle-card"}
      onClick={(event) => onSelect(entry, event.currentTarget)}
      style={{ "--reveal-delay": `${Math.min(index * 55, 360)}ms` }}
      type="button"
    >
      <span className="oc-bottle-card__shine" aria-hidden="true" />
      <span className="oc-bottle-card__vintage">{vintage}</span>

      <span className="oc-bottle-card__visual">
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt={`${entry.wineName} bottle`} />
        ) : (
          <WineBottleMark tone={getBottleTone(entry)} />
        )}
      </span>

      <span className="oc-bottle-card__copy">
        <span className="oc-bottle-card__style">{entry.style}</span>
        <strong>{entry.wineName}</strong>
        <span>{entry.winery}</span>
      </span>

      <span className="oc-bottle-card__meta">
        <span>
          <Star size={14} />
          {rating}
        </span>
        {entry.isFavorite ? (
          <span>
            <Heart size={14} />
            Favorite
          </span>
        ) : (
          <span>
            <Sparkles size={14} />
            {entry.region || entry.country || "Cellar"}
          </span>
        )}
      </span>
    </button>
  );
}
