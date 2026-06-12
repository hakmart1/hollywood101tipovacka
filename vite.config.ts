import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward API calls to `wrangler pages dev` so the Vite dev server
      // (with HMR) can be used against the local Pages Functions backend.
      "/api": "http://localhost:8788"
    }
  }
});
