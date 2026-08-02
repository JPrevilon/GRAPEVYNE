import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import AppProviders from "@/app/AppProviders";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-500.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@/styles/global.css";
import "@/styles/design-system.css";
import "@/styles/product-routes.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("GRAPEVYNE could not find its root element.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
