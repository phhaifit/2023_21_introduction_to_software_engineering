import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App.tsx";
import { ToastProvider } from "./components/shared/Toast.tsx";
import "./app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element for frontend app");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
