import React from "react";
import { createRoot } from "react-dom/client";
import AscentApp from "./AscentApp.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(<AscentApp />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
