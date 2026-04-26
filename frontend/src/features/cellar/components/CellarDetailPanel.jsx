import { Heart, Save, Star, Trash2, Wine } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "../../../components/ui/useToast.js";
import { validateCellarForm } from "../../../utils/formValidation.js";
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

export default function CellarDetailPanel({ entry, onDelete, onUpdate }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    notes: entry?.notes || "",
    userRating: entry?.userRating || "",
    occasion: entry?.occasion || "",
    favorite: Boolean(entry?.favorite),
  });
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setFormData({
      notes: entry?.notes || "",
      userRating: entry?.userRating || "",
      occasion: entry?.occasion || "",
      favorite: Boolean(entry?.favorite),
    });
    setStatus("idle");
    setErrorMessage("");
  }, [entry]);

  if (!entry) {
    return (
      <aside className="open-cellar-detail">
        <div className="open-cellar-detail__empty">
          <Wine size={28} />
          <h2>Select a bottle</h2>
          <p>Choose a bottle from any shelf to view details and edit your notes.</p>
        </div>
      </aside>
    );
  }

  function handleChange(event) {
    const { checked, name, type, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setStatus("idle");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const validationError = validateCellarForm(formData);

    if (validationError) {
      setStatus("idle");
      setErrorMessage(validationError);
      showToast({
        title: "Check the cellar note",
        message: validationError,
        tone: "error",
      });
      return;
    }

    try {
      await onUpdate(entry.id, {
        notes: formData.notes,
        userRating: formData.userRating ? Number(formData.userRating) : null,
        occasion: formData.occasion,
        favorite: formData.favorite,
      });
      setStatus("saved");
      showToast({
        title: "Bottle updated",
        message: `${entry.wine.name} was updated.`,
      });
    } catch (error) {
      const message = error.message || "Could not update this bottle.";
      setStatus("idle");
      setErrorMessage(message);
      showToast({
        title: "Update failed",
        message,
        tone: "error",
      });
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Remove ${entry.wine.name} from your cellar?`
    );

    if (!confirmed) {
      return;
    }

    setStatus("deleting");
    setErrorMessage("");

    try {
      await onDelete(entry.id);
      showToast({
        title: "Bottle removed",
        message: `${entry.wine.name} was removed from your cellar.`,
      });
    } catch (error) {
      const message = error.message || "Could not delete this bottle.";
      setStatus("idle");
      setErrorMessage(message);
      showToast({
        title: "Delete failed",
        message,
        tone: "error",
      });
    }
  }

  return (
    <aside className="open-cellar-detail">
      <div className="open-cellar-detail__hero">
        <div className="open-cellar-detail__bottle">
          {entry.wine.imageUrl ? (
            <img src={entry.wine.imageUrl} alt={`${entry.wine.name} bottle`} />
          ) : (
            <WineBottleMark tone={getBottleTone(entry.wine.varietal)} />
          )}
        </div>
        <div>
          <p className="eyebrow">{entry.wine.varietal}</p>
          <h2>{entry.wine.name}</h2>
          <p>{entry.wine.winery}</p>
        </div>
      </div>

      <div className="open-cellar-detail__facts">
        <span>{entry.wine.region}</span>
        <span>{entry.wine.vintage}</span>
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
      </div>

      <form className="cellar-edit-form" onSubmit={handleSubmit}>
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <label>
          Personal rating
          <select
            name="userRating"
            onChange={handleChange}
            value={formData.userRating}
          >
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
            onChange={handleChange}
            placeholder="Dinner, gift, celebration..."
            type="text"
            value={formData.occasion}
          />
        </label>

        <label>
          Notes
          <textarea
            name="notes"
            onChange={handleChange}
            placeholder="What did you taste? Who was there? Would you buy it again?"
            rows="5"
            value={formData.notes}
          />
        </label>

        <label className="checkbox-row">
          <input
            checked={formData.favorite}
            name="favorite"
            onChange={handleChange}
            type="checkbox"
          />
          Mark as favorite
        </label>

        <div className="cellar-entry__actions">
          <button className="primary-button" disabled={status === "saving"} type="submit">
            <Save size={17} />
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save"}
          </button>
          <button
            className="secondary-button danger-button"
            disabled={status === "deleting"}
            onClick={handleDelete}
            type="button"
          >
            <Trash2 size={17} />
            {status === "deleting" ? "Removing..." : "Remove"}
          </button>
        </div>
      </form>
    </aside>
  );
}
