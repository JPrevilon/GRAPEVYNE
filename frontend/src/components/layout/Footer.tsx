import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="gv-footer">
      <Link aria-label="GRAPEVYNE home" className="gv-footer__brand" to="/">
        <img alt="" src="/assets/brand/grapevyne-wordmark.svg" />
      </Link>
      <p>Wine discovery and private cellar memory, handled with restraint.</p>
      <nav aria-label="Footer navigation">
        <Link to="/discover">Discover</Link>
        <Link to="/demo/cellar">Public demo</Link>
      </nav>
    </footer>
  );
}
