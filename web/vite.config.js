import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The built SPA is served by the Express proxy (server-reference/) which also
// exposes /api/*. In dev, proxy /api to that backend so the app talks to NocoDB
// through the same contract as production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500, // vendored xlsx is large; keep build output quiet
  },
});
