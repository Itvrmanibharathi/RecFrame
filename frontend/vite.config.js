import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.js"],
  },
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:8000",
      "/api":  "http://localhost:8000",
    },
  },
});
