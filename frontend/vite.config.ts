import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When running in Docker, VITE_API_PROXY points to the backend service
// (e.g. http://backend:8000). Locally it defaults to localhost.
const apiTarget = process.env.VITE_API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
