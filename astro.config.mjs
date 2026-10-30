import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

const isDev = process.argv.includes("dev") || process.env.npm_lifecycle_event === "dev";

export default defineConfig({
  output: "server",
  adapter: isDev ? node({ mode: "standalone" }) : cloudflare({ imageService: "compile" }),
  site: "https://acp.dpdns.org",
  vite: {
    plugins: isDev ? [
      {
        name: "stub-cloudflare-workers-dev",
        enforce: "pre",
        resolveId(id) {
          if (id === "cloudflare:workers") return "\0cloudflare:workers";
        },
        load(id) {
          if (id === "\0cloudflare:workers") return "export const env = {};";
        },
      },
    ] : [],
  },
});
