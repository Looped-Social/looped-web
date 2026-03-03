import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  future: {
    // Needed for Cloudflare Workers/Vite integration.
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
