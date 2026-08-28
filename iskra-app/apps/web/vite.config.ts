import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    /* Proxy the API in development so the page and the API share an origin.
       Without this the browser labels requests sec-fetch-site: cross-site and
       the API's CSRF guard rejects them, and the session cookie is never sent
       with <img> requests for profile portraits. Production serves both from
       the same host, so no proxy is needed there. */
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4311",
        changeOrigin: false
      }
    }
  }
});

