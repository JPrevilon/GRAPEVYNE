import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Star, X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function BottleDetailPanel({ bottle, isOpen, onClose }) {
  const closeButtonRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen && bottle) {
      closeButtonRef.current?.focus();
    }
  }, [bottle, isOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!bottle) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          className="interactive-detail-panel"
          aria-labelledby={`interactive-detail-${bottle.cellarEntryId}`}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 44, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 30, scale: 0.98 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            ref={closeButtonRef}
            className="interactive-detail-panel__close"
            type="button"
            aria-label="Close bottle details"
            onClick={onClose}
          >
            <X size={18} />
          </button>

          <div className="interactive-detail-panel__hero">
            <div
              className={`interactive-detail-panel__bottle interactive-detail-panel__bottle--${bottle.labelColor}${bottle.imageUrl ? " has-image" : ""}`}
            >
              {bottle.imageUrl ? (
                <img src={bottle.imageUrl} alt={`${bottle.name} bottle`} />
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="eyebrow">{bottle.type} · {bottle.varietal}</p>
              <h2 id={`interactive-detail-${bottle.cellarEntryId}`}>{bottle.name}</h2>
              <p>{bottle.producer}</p>
            </div>
          </div>

          <p className="demo-read-only-note">
            Read-only demonstration. This fictional bottle is not saved to an account.
          </p>

          <div className="interactive-detail-panel__facts">
            <span>{bottle.vintage}</span>
            <span>{[bottle.region, bottle.country].filter(Boolean).join(", ")}</span>
            <span><Star size={14} />{bottle.rating}/5</span>
            {bottle.favorite ? <span><Heart size={14} />Favorite</span> : null}
          </div>

          <section className="interactive-detail-section">
            <h3>Tasting Notes</h3>
            <p>{bottle.notes}</p>
          </section>
          <section className="interactive-detail-section">
            <h3>Occasion</h3>
            <p>{bottle.occasion}</p>
          </section>
          <section className="interactive-detail-section">
            <h3>Pairings</h3>
            <div className="tag-list">
              {bottle.pairings.map((pairing) => <span key={pairing}>{pairing}</span>)}
            </div>
          </section>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
