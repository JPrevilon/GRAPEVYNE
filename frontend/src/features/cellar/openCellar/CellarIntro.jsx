import { ChevronDown, DoorOpen } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function CellarIntro({ onEnter }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="interactive-cellar-intro" aria-labelledby="open-cellar-heading">
      <div className="interactive-cellar-intro__glow" aria-hidden="true" />
      <motion.div
        className="interactive-cellar-intro__copy"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="eyebrow">GrapeVyne private room</p>
        <h2 id="open-cellar-heading">Open Cellar</h2>
        <p>
          Enter a visual cellar built around bottles, moods, occasions, and the
          stories worth opening again.
        </p>
        <button className="primary-button" type="button" onClick={onEnter}>
          <DoorOpen size={18} />
          Enter Cellar
        </button>
      </motion.div>

      <button className="interactive-cellar-intro__cue" type="button" onClick={onEnter}>
        <ChevronDown size={18} />
        Scroll into the cellar
      </button>
    </section>
  );
}
