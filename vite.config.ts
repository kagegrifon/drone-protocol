import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const isCI = !!process.env.CI;

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

  optimizeDeps: isCI
    ? {}
    : {
        // Monaco manages its own workers via ?worker imports; esbuild pre-bundling breaks them.
        // This exclude is needed only in dev-mode for local HMR iteration.
        exclude: ["monaco-editor"],
      },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "e2e/**", ".claude/**"],
  },
}));
