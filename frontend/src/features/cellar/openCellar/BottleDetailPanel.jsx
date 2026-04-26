import { AnimatePresence, motion } from "framer-motion";
import { Heart, Pencil, Save, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useToast } from "../../../components/ui/useToast.js";
import { validateCellarForm } from "../../../utils/formValidation.js";

export default function BottleDetailPanel({
  bottle,
  isOpen,
  onClose,
  onRemove,
  onToggleFavorite,
  onUpdate,
}) {
  const { showToast } = useToast();
  const closeButtonRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    notes: "",
    userRating: "",
    occasion: "",
  });

  useEffect(() => {
    setFormData({
      notes: bottle?.notes || "",
      userRating: bottle?.rating || "",
      occasion: bottle?.occasion || "",
    });
    setIsEditing(false);
    setIsConfirmingDelete(false);
    setErrorMessage("");
  }, [bottle]);

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

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrorMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateCellarForm(formData);

    if (validationError) {
      setErrorMessage(validationError);
      showToast({
        title: "Check the cellar note",
        message: validationError,
        tone: "error",
      });
      return;
    }

    onUpdate(bottle.cellarEntryId, {
      notes: formData.notes,
      rating: formData.userRating ? Number(formData.userRating) : null,
      occasion: formData.occasion,
    });
    setIsEditing(false);
    showToast({
      title: "Bottle updated",
      message: `${bottle.name} was updated in this cellar view.`,
    });
  }

  function handleFavoriteToggle() {
    onToggleFavorite(bottle.cellarEntryId);
    showToast({
      title: bottle.favorite ? "Removed from favorites" : "Added to favorites",
      message: `${bottle.name} was updated.`,
    });
  }

  function handleRemove() {
    onRemove(bottle.cellarEntryId);
    showToast({
      title: "Bottle removed",
      message: `${bottle.name} was removed from the mock cellar.`,
    });
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          className="interactive-detail-panel"
          aria-labelledby={`interactive-detail-${bottle.cellarEntryId}`}
          initial={{ opacity: 0, x: 44, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 30, scale: 0.98 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
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
            <div className={`interactive-detail-panel__bottle interactive-detail-panel__bottle--${bottle.labelColor}`} aria-hidden="true">
              <span />
            </div>
            <div>
              <p className="eyebrow">{bottle.type} · {bottle.varietal}</p>
              <h2 id={`interactive-detail-${bottle.cellarEntryId}`}>{bottle.name}</h2>
              <p>{bottle.producer}</p>
            </div>
          </div>

          <div className="interactive-detail-panel__facts">
            <span>{bottle.vintage || "NV"}</span>
            <span>{[bottle.region, bottle.country].filter(Boolean).join(", ")}</span>
            <span>
              <Star size={14} />
              {bottle.rating ? `${bottle.rating}/5` : "Unrated"}
            </span>
            {bottle.favorite ? (
              <span>
                <Heart size={14} />
                Favorite
              </span>
            ) : null}
          </div>

          <div className="interactive-detail-panel__actions">
            <button
              className={bottle.favorite ? "oc-action-button is-active" : "oc-action-button"}
              type="button"
              onClick={handleFavoriteToggle}
            >
              <Heart size={16} />
              {bottle.favorite ? "Favorited" : "Favorite"}
            </button>
            <button
              className="oc-action-button"
              type="button"
              onClick={() => {
                setIsEditing((current) => !current);
                setIsConfirmingDelete(false);
              }}
            >
              <Pencil size={16} />
              {isEditing ? "Close Edit" : "Edit Notes"}
            </button>
            <button
              className="oc-action-button oc-action-button--danger"
              type="button"
              onClick={() => {
                setIsConfirmingDelete(true);
                setIsEditing(false);
              }}
            >
              <Trash2 size={16} />
              Remove
            </button>
          </div>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          {isConfirmingDelete ? (
            <div className="oc-delete-confirmation" aria-live="polite">
              <div>
                <h3>Remove from cellar?</h3>
                <p>This removes the bottle from the mock Open Cellar scene.</p>
              </div>
              <div className="oc-delete-confirmation__actions">
                <button className="secondary-button" type="button" onClick={() => setIsConfirmingDelete(false)}>
                  Cancel
                </button>
                <button className="secondary-button danger-button" type="button" onClick={handleRemove}>
                  <Trash2 size={17} />
                  Remove Bottle
                </button>
              </div>
            </div>
          ) : null}

          <section className="interactive-detail-section">
            <h3>Tasting Notes</h3>
            <p>{bottle.notes || "No tasting notes yet."}</p>
          </section>

          <section className="interactive-detail-section">
            <h3>Occasion</h3>
            <p>{bottle.occasion || "Not recorded"}</p>
          </section>

          <section className="interactive-detail-section">
            <h3>Pairings</h3>
            <div className="tag-list">
              {bottle.pairings.map((pairing) => (
                <span key={pairing}>{pairing}</span>
              ))}
            </div>
          </section>

          {isEditing ? (
            <form className="cellar-edit-form interactive-detail-panel__form" onSubmit={handleSubmit}>
              <label>
                Personal rating
                <select name="userRating" value={formData.userRating} onChange={handleChange}>
                  <option value="">Unrated</option>
                  <option value="1">1 - Not for me</option>
                  <option value="2">2 - Fine</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Excellent</option>
                  <option value="5">5 - Cellar favorite</option>
                </select>
              </label>
              <label>
                Occasion
                <input
                  name="occasion"
                  type="text"
                  value={formData.occasion}
                  onChange={handleChange}
                  placeholder="Dinner, gift, celebration..."
                />
              </label>
              <label>
                Private notes
                <textarea
                  name="notes"
                  rows="4"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="What did you taste? Who was there?"
                />
              </label>
              <div className="cellar-entry__actions">
                <button className="primary-button" type="submit">
                  <Save size={17} />
                  Save
                </button>
                <button className="secondary-button" type="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
