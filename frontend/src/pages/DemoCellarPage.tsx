import OpenCellarPage from "@/features/cellar/openCellar/OpenCellarPage.jsx";
import { Link } from "react-router-dom";

export default function DemoCellarPage() {
  return (
    <div className="demo-page" data-demo-surface="cellar">
      <section className="demo-notice" aria-labelledby="demo-cellar-title">
        <p className="eyebrow">Public demonstration · Read-only</p>
        <h1 id="demo-cellar-title">Explore a fictional GRAPEVYNE cellar</h1>
        <p>
          These 11 illustrative bottles are not an authenticated user&apos;s saved
          wines. Opening a bottle only reveals its demo details; nothing here is
          persisted or sent to the cellar API.
        </p>
        <Link className="text-link" to="/demo/taste-atlas">
          View the demo Taste Atlas
        </Link>
      </section>
      <OpenCellarPage />
    </div>
  );
}
