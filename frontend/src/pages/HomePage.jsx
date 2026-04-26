import { Link } from "react-router-dom";
import { ArrowRight, Wine } from "lucide-react";

export default function HomePage() {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <img
          className="hero-logo"
          src="/images/grapevyne-logo.png"
          alt="GrapeVyne Discover Save Savor"
        />
        <p className="eyebrow">Premium wine discovery</p>
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
        <img src="/images/home-cellar-hero.png" alt="Sunlit wine cellar with wooden shelves and bottles" />
        <p className="hero-image-caption">Choose the right bottle. Remember every one worth keeping.</p>
      </div>
    </section>
  );
}
