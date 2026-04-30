import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/v1": {
        target,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/v1/, ""),
      },
      "/health": {
        target,
        changeOrigin: true,
        secure: false,
      },
      "/forge": {
        target,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
