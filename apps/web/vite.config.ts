import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [
    cloudflare({
      // Merge Cloudflare Worker output into React Router's SSR environment.
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
