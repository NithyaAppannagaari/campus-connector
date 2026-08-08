import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/mutuals": "http://localhost:8788",
      "/api/event": "http://localhost:8788",
      "/api/create-event": "http://localhost:8788",
      "/api/raw": "http://localhost:8788",
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
