import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import AppProviders from "@/app/AppProviders";
import { installSafeDevelopmentConsole } from "@/lib/safeDevelopmentConsole";
import "@fontsource-variable/raleway/wght.css";
import "@fontsource-variable/jost/wght.css";
import "@/styles/global.css";
import "@/styles/design-system.css";
import "@/styles/product-routes.css";

const rootElement = document.getElementById("root");

if (import.meta.env.DEV) installSafeDevelopmentConsole();

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
