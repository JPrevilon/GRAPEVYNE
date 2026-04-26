import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Wine } from "lucide-react";

export default function HomePage() {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">Premium wine discovery</p>
        <h1>Choose the right bottle, remember every one worth keeping.</h1>
        <p>
          GrapeVyne brings elegant wine search and a personal digital cellar
          into one calm, cinematic product experience.
        </p>
        <div className="hero-actions">
          <Link to="/discover" className="primary-button">
            Discover Wines
            <ArrowRight size={18} />
          </Link>
          <Link to="/cellar" className="secondary-button">
            <Wine size={18} />
            Open Cellar
          </Link>
        </div>
      </div>

      <div className="hero-panel" aria-label="GrapeVyne cellar preview">
        <div className="bottle-stage">
          <div className="bottle-card bottle-card--front">
            <span className="bottle-neck" />
            <span className="bottle-body" />
          </div>
          <div className="bottle-card bottle-card--rear">
            <span className="bottle-neck" />
            <span className="bottle-body" />
          </div>
        </div>
        <div className="tasting-note">
          <Sparkles size={18} />
          <div>
            <strong>Tonight&apos;s cellar</strong>
            <span>Saved bottles, ratings, notes, and future pairings.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
