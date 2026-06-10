import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  publicDir: "public",
  base: command === "build" ? "/drone-protocol/" : "/",

  define: {
    __BUNDLED_DEV__: "true",
    __SERVER_FORWARD_CONSOLE__: "false",
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "e2e/**", ".claude/**"],
  },
}));
