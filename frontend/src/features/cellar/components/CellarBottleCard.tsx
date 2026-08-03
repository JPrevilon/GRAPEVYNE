import { CalendarDays, Check, Heart, Star } from "lucide-react";

import { WineVisual } from "@/components/wine/WineBottleFallback";
import type { CellarEntry } from "@/types/domain";

import {
  CELLAR_STATUS_LABELS,
  cellarEntryTriggerId,
  formatCellarSavedDate,
} from "./cellarPresentation";

interface CellarBottleCardProps {
  disabled?: boolean;
  entry: CellarEntry;
  index: number;
  isSelected: boolean;
  onSelect: (entry: CellarEntry) => void;
}

export default function CellarBottleCard({
  disabled = false,
  entry,
  index,
  isSelected,
  onSelect,
}: CellarBottleCardProps) {
  const { wine } = entry;
  const savedDate = formatCellarSavedDate(entry.savedAt);
  const origin = [wine.region, wine.country].filter(Boolean).join(", ");

  return (
    <button
      aria-controls="live-cellar-detail"
      aria-expanded={isSelected}
      aria-pressed={isSelected}
      className={`gv-cellar-bottle${isSelected ? " gv-cellar-bottle--selected" : ""}`}
      disabled={disabled}
      id={cellarEntryTriggerId(entry.id)}
      onClick={() => onSelect(entry)}
      type="button"
    >
      <span aria-hidden="true" className="gv-cellar-bottle__glow" />
      <span aria-hidden="true" className="gv-cellar-bottle__index">
        {String(index).padStart(2, "0")}
      </span>
      <span className="gv-cellar-bottle__visual">
        <WineVisual
          imageUrl={wine.imageUrl}
          label={wine.name}
          varietal={wine.varietal}
        />
      </span>

      <span className="gv-cellar-bottle__copy">
        {wine.varietal ? (
          <span className="gv-eyebrow gv-eyebrow--data">{wine.varietal}</span>
        ) : null}
        <strong>{wine.name}</strong>
        {entry.memoryTitle ? (
          <span className="gv-cellar-bottle__memory-title">{entry.memoryTitle}</span>
        ) : null}
        {wine.winery ? <span>{wine.winery}</span> : null}
        {origin ? <span>{origin}</span> : null}
      </span>

      <span className="gv-cellar-bottle__meta">
        <span>{CELLAR_STATUS_LABELS[entry.status]}</span>
        {entry.userRating !== null ? (
          <span>
            <Star aria-hidden="true" size={14} />
            {entry.userRating}/5
          </span>
        ) : null}
        {entry.favorite ? (
          <span>
            <Heart aria-hidden="true" size={14} />
            Favorite
          </span>
        ) : null}
        {entry.wouldBuyAgain === true || entry.status === "buy_again" ? (
          <span>
            <Check aria-hidden="true" size={14} />
            Buy again
          </span>
        ) : null}
        {savedDate ? (
          <span>
            <CalendarDays aria-hidden="true" size={14} />
            Saved {savedDate}
          </span>
        ) : null}
      </span>
    </button>
  );
}
