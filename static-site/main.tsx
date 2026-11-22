import React from "react"; // Static entry point; the local Next.js app keeps its own entry.
import { createRoot } from "react-dom/client";
import Dashboard from "../src/components/dashboard";
import "../src/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard staticDataUrl={`${import.meta.env.BASE_URL}data/dashboard.json`} />
  </React.StrictMode>,
);
