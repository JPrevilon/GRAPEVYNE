import { AnimatePresence, motion } from "framer-motion";

import BottleMarker from "./BottleMarker.jsx";

export default function CellarZoomView({
  hoveredBottleId,
  onBottleHover,
  onBottleSelect,
  section,
  selectedBottleId,
}) {
  return (
    <AnimatePresence mode="wait">
      {section ? (
        <motion.section
          className="interactive-cellar-zoom"
          key={section.sectionId}
          aria-labelledby={`cellar-zoom-${section.sectionId}`}
          initial={{ opacity: 0, scale: 0.96, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 16 }}
          transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="interactive-cellar-zoom__header">
            <p className="eyebrow">{section.theme}</p>
            <h2 id={`cellar-zoom-${section.sectionId}`}>{section.sectionName}</h2>
            <p>{section.description}</p>
          </div>

          <div className="interactive-cellar-zoom__wall" aria-label={`${section.sectionName} bottles`}>
            {section.bottles.map((bottle, index) => (
              <BottleMarker
                bottle={bottle}
                index={index}
                isHovered={hoveredBottleId === bottle.cellarEntryId}
                isSelected={selectedBottleId === bottle.cellarEntryId}
                key={bottle.cellarEntryId}
                onHover={onBottleHover}
                onSelect={onBottleSelect}
              />
            ))}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
