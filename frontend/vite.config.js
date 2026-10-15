import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api calls are proxied to FastAPI so there are no CORS issues in dev.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
