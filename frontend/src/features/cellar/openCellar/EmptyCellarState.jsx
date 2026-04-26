import { Search, Wine } from "lucide-react";
import { Link } from "react-router-dom";

export default function EmptyCellarState() {
  return (
    <section className="oc-empty-state">
      <div className="oc-empty-state__bottle" aria-hidden="true">
        <Wine size={64} strokeWidth={1.2} />
      </div>
      <p className="eyebrow">Empty cellar</p>
      <h1>Your private cellar is waiting.</h1>
      <p>
        Save a bottle from Discover to begin building shelves around favorites,
        pairings, rare finds, and celebrations.
      </p>
      <Link className="primary-button state-panel__action" to="/discover">
        <Search size={18} />
        Find a Wine
      </Link>
    </section>
  );
}
