import { Heart, Star } from "lucide-react";
import { motion } from "framer-motion";

function getBottleClass(labelColor) {
  return `interactive-bottle-marker__bottle interactive-bottle-marker__bottle--${
    labelColor || "deep-red"
  }`;
}

export default function BottleMarker({
  bottle,
  index,
  isHovered,
  isSelected,
  onHover,
  onSelect,
}) {
  return (
    <motion.button
      aria-label={`${bottle.name}, ${bottle.producer}, ${bottle.vintage}, ${bottle.rating || "unrated"} stars`}
      className={[
        "interactive-bottle-marker",
        isSelected ? "is-selected" : "",
        isHovered ? "is-hovered" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.055, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -10, scale: 1.04 }}
      onBlur={() => onHover(null)}
      onClick={(event) => onSelect(bottle, event.currentTarget)}
      onFocus={() => onHover(bottle.cellarEntryId)}
      onMouseEnter={() => onHover(bottle.cellarEntryId)}
      onMouseLeave={() => onHover(null)}
      type="button"
    >
      <span className="interactive-bottle-marker__halo" aria-hidden="true" />
      <span className={getBottleClass(bottle.labelColor)} aria-hidden="true">
        <span />
      </span>
      <span className="interactive-bottle-marker__preview">
        <strong>{bottle.name}</strong>
        <span>{bottle.vintage} · {bottle.region}</span>
      </span>
      <span className="interactive-bottle-marker__meta">
        <span>
          <Star size={13} />
          {bottle.rating || "Unrated"}
        </span>
        {bottle.favorite ? (
          <span>
            <Heart size={13} />
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}
