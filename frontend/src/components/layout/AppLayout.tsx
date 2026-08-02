import { Outlet } from "react-router-dom";

import ProductNavigation from "@/components/navigation/ProductNavigation";

import Footer from "./Footer";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <a className="gv-skip-link" href="#main-content">
        Skip to main content
      </a>
      <ProductNavigation />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
