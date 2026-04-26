import { motion } from "framer-motion";

export default function CellarSection({
  isActive,
  isDimmed,
  isHovered,
  onHover,
  onSelect,
  section,
}) {
  return (
    <motion.button
      aria-label={`Open ${section.sectionName}: ${section.description}`}
      className={[
        "interactive-cellar-section",
        isActive ? "is-active" : "",
        isHovered ? "is-hovered" : "",
        isDimmed ? "is-dimmed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      initial={false}
      whileHover={{ y: -4 }}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(section.sectionId)}
      onFocus={() => onHover(section.sectionId)}
      onMouseEnter={() => onHover(section.sectionId)}
      onMouseLeave={() => onHover(null)}
      style={{
        left: `${section.position.x}%`,
        top: `${section.position.y}%`,
        width: `${section.position.width}%`,
        height: `${section.position.height}%`,
      }}
      type="button"
    >
      <span className="interactive-cellar-section__light" aria-hidden="true" />
      <span className="interactive-cellar-section__shelves" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="interactive-cellar-section__label">
        <span>{section.theme}</span>
        <strong>{section.sectionName}</strong>
        <em>{section.bottles.length} bottles</em>
      </span>
    </motion.button>
  );
}
