import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import CellarSection from "./CellarSection.jsx";
import CellarZoomView from "./CellarZoomView.jsx";

export default function CellarScene({
  activeSection,
  hoveredBottleId,
  hoveredSection,
  onBottleHover,
  onBottleSelect,
  onSectionHover,
  onSectionSelect,
  sections,
  selectedBottleId,
}) {
  const sceneRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start end", "end start"],
  });
  const wallY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [-24, 34]
  );
  const lightY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["45%", "45%"] : ["18%", "78%"]
  );
  const selectedSection = sections.find((section) => section.sectionId === activeSection);

  return (
    <section className="interactive-cellar-scene" ref={sceneRef} aria-label="Interactive wine cellar">
      <motion.div className="interactive-cellar-scene__ambient" style={{ y: wallY }} aria-hidden="true">
        <motion.span style={{ top: lightY }} />
      </motion.div>

      <div className="interactive-cellar-scene__copy">
        <p className="eyebrow">The wine wall</p>
        <h2>Choose a section.</h2>
        <p>
          Move through the room by section, then step closer to inspect the
          bottles inside.
        </p>
      </div>

      <div
        className={activeSection ? "interactive-cellar-wall is-zooming" : "interactive-cellar-wall"}
      >
        <div className="interactive-cellar-wall__lounge" aria-hidden="true">
          <span className="interactive-cellar-wall__seat" />
          <span className="interactive-cellar-wall__table" />
        </div>

        <motion.div
          className="interactive-cellar-wall__surface"
          animate={{
            scale: activeSection ? 1.08 : 1,
            x: activeSection && selectedSection ? `${50 - selectedSection.position.x - selectedSection.position.width / 2}%` : "0%",
            y: activeSection && selectedSection ? `${42 - selectedSection.position.y - selectedSection.position.height / 2}%` : "0%",
          }}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        >
          {sections.map((section) => (
            <CellarSection
              isActive={activeSection === section.sectionId}
              isDimmed={Boolean(activeSection && activeSection !== section.sectionId)}
              isHovered={hoveredSection === section.sectionId}
              key={section.sectionId}
              onHover={onSectionHover}
              onSelect={onSectionSelect}
              section={section}
            />
          ))}
        </motion.div>

        <AnimatePresence>
          {activeSection ? (
            <motion.div
              className="interactive-cellar-wall__scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32 }}
              aria-hidden="true"
            />
          ) : null}
        </AnimatePresence>
      </div>

      <CellarZoomView
        hoveredBottleId={hoveredBottleId}
        onBottleHover={onBottleHover}
        onBottleSelect={onBottleSelect}
        section={selectedSection}
        selectedBottleId={selectedBottleId}
      />
    </section>
  );
}
