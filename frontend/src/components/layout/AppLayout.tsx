import { Outlet } from "react-router-dom";

import ProductNavigation from "@/components/navigation/ProductNavigation";
import AppErrorBoundary from "@/components/routing/AppErrorBoundary";
import RouteMetadata from "@/components/routing/RouteMetadata";

import Footer from "./Footer";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <a className="gv-skip-link" href="#main-content">
        Skip to main content
      </a>
      <RouteMetadata />
      <ProductNavigation />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <AppErrorBoundary>
          <Outlet />
        </AppErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
