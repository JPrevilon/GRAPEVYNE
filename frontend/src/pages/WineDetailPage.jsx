import { ArrowLeft, Heart, MapPin, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useToast } from "../components/ui/useToast.js";
import { saveWineToCellar } from "../features/cellar/cellarApi.js";
import { useAuth } from "../features/auth/useAuth.js";
import WineBottleMark from "../features/wines/components/WineBottleMark.jsx";
import { getWineDetail } from "../features/wines/wineApi.js";

function formatPrice(priceCents) {
  if (!priceCents) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

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

export default function WineDetailPage() {
  const { wineId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const [wine, setWine] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWineDetail() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const response = await getWineDetail(wineId);

        if (!active) {
          return;
        }

        setWine(response.data.wine);
        setStatus("ready");
      } catch (error) {
        if (!active) {
          return;
        }

        setWine(null);
        setErrorMessage(error.message || "Wine detail could not be loaded.");
        setStatus("error");
      }
    }

    loadWineDetail();

    return () => {
      active = false;
    };
  }, [wineId]);

  async function handleSaveToCellar() {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      await saveWineToCellar({
        wine,
      });
      setSaveStatus("saved");
      setSaveMessage("Saved to your cellar.");
      showToast({
        title: "Saved to cellar",
        message: `${wine.name} is now in your Open Cellar.`,
      });
    } catch (error) {
      if (error.code === "cellar_entry_exists") {
        setSaveStatus("saved");
        setSaveMessage("This bottle is already in your cellar.");
        showToast({
          title: "Already saved",
          message: `${wine.name} is already in your cellar.`,
        });
        return;
      }

      setSaveStatus("idle");
      const message = error.message || "Could not save this bottle.";
      setSaveMessage(message);
      showToast({
        title: "Save failed",
        message,
        tone: "error",
      });
    }
  }

  if (status === "loading") {
    return (
      <section className="state-panel">
        <p className="eyebrow">Wine detail</p>
        <h1>Opening the bottle profile.</h1>
        <p>Loading tasting notes, pairings, and source data.</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="state-panel">
        <p className="eyebrow">Wine detail</p>
        <h1>This bottle was not found.</h1>
        <p>{errorMessage}</p>
        <Link className="secondary-button state-panel__action" to="/discover">
          <ArrowLeft size={18} />
          Back to Discover
        </Link>
      </section>
    );
  }

  return (
    <article className="wine-detail">
      <Link className="detail-back-link" to="/discover">
        <ArrowLeft size={18} />
        Back to Discover
      </Link>

      <section className="wine-detail__hero">
        <div className="wine-detail__visual">
          {wine.imageUrl ? (
            <img src={wine.imageUrl} alt={`${wine.name} bottle`} />
          ) : (
            <WineBottleMark tone={getBottleTone(wine.varietal)} />
          )}
        </div>

        <div className="wine-detail__content">
          <p className="eyebrow">{wine.varietal}</p>
          <h1>{wine.name}</h1>
          <p className="wine-detail__winery">{wine.winery}</p>
          <p className="wine-detail__description">{wine.description}</p>

          <div className="wine-detail__facts">
            <span>
              <MapPin size={16} />
              {wine.region}, {wine.country}
            </span>
            <span>
              <Star size={16} />
              {wine.averageRating?.toFixed(1) || "Unrated"}
            </span>
            <span>{wine.vintage}</span>
            <span>{formatPrice(wine.priceCents)}</span>
          </div>

          <button
            className="primary-button"
            disabled={isAuthLoading || saveStatus === "saving" || saveStatus === "saved"}
            onClick={handleSaveToCellar}
            type="button"
          >
            <Heart size={18} />
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved"
                : "Save to Cellar"}
          </button>
          {saveMessage ? <p className="save-message">{saveMessage}</p> : null}
        </div>
      </section>

      <section className="wine-detail__sections">
        <div className="detail-section">
          <p className="eyebrow">Tasting Notes</p>
          <div className="tag-list">
            {wine.tastingNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <p className="eyebrow">Pairings</p>
          <div className="tag-list">
            {wine.pairings.map((pairing) => (
              <span key={pairing}>{pairing}</span>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <p className="eyebrow">Structure</p>
          <dl className="structure-list">
            <div>
              <dt>Body</dt>
              <dd>{wine.body}</dd>
            </div>
            <div>
              <dt>Acidity</dt>
              <dd>{wine.acidity}</dd>
            </div>
            <div>
              <dt>Sweetness</dt>
              <dd>{wine.sweetness}</dd>
            </div>
            <div>
              <dt>Serve</dt>
              <dd>{wine.servingTemp}</dd>
            </div>
          </dl>
        </div>
      </section>
    </article>
  );
}
