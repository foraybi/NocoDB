import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts (bundled by Vite — no runtime CDN).
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";

// Mantine styles (core first).
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/dropzone/styles.css";
import "./global.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
