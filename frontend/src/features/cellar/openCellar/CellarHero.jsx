import { ChevronDown, Search, Wine } from "lucide-react";
import { Link } from "react-router-dom";

import WineBottleMark from "../../wines/components/WineBottleMark.jsx";

export default function CellarHero({ featuredBottle, onOpenCellar }) {
  return (
    <section className="oc-hero" aria-labelledby="open-cellar-title">
      <div className="oc-hero__light" aria-hidden="true" />
      <div className="oc-hero__copy">
        <p className="eyebrow">Signature cellar experience</p>
        <h1 id="open-cellar-title">Open Cellar</h1>
        <p>
          Step through your saved wines by mood, memory, pairing, and occasion.
        </p>
        <div className="oc-hero__actions">
          <button className="primary-button" onClick={onOpenCellar} type="button">
            <Wine size={18} />
            Open Your Cellar
          </button>
          <Link className="secondary-button" to="/discover">
            <Search size={18} />
            Add a Bottle
          </Link>
        </div>
      </div>

      <div className="oc-hero__bottle" aria-hidden="true">
        <span className="oc-hero__halo" />
        {featuredBottle?.imageUrl ? (
          <img src={featuredBottle.imageUrl} alt="" />
        ) : (
          <WineBottleMark tone={featuredBottle?.type === "white" ? "gold" : "red"} />
        )}
        <span className="oc-hero__label">
          <span>{featuredBottle?.vintage || "Private"}</span>
          <strong>{featuredBottle?.wineName || "Cellar Selection"}</strong>
        </span>
      </div>

      <button className="oc-hero__scroll" onClick={onOpenCellar} type="button">
        <ChevronDown size={18} />
        Enter
      </button>
    </section>
  );
}
