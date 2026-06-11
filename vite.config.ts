import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  publicDir: "public",
  base: command === "build" ? "/drone-protocol/" : "/",

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  define: {
    __BUNDLED_DEV__: "true",
    __SERVER_FORWARD_CONSOLE__: "false",
  },

  optimizeDeps: {
    exclude: ["monaco-editor"],
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "e2e/**", ".claude/**"],
  },
}));
