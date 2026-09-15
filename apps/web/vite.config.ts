import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  // Load root .env so EXPO_PUBLIC_* / VITE_* from monorepo root work in local dev.
  const env = loadEnv(mode, repoRoot, ["VITE_", "EXPO_PUBLIC_"]);
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    envDir: repoRoot,
    envPrefix: ["VITE_", "EXPO_PUBLIC_"],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@anymarkt/shared": path.resolve(__dirname, "../../packages/shared/src"),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 4173,
      host: true,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
