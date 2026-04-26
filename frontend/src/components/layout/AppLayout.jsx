import { Outlet } from "react-router-dom";

import Footer from "./Footer.jsx";
import Header from "./Header.jsx";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

