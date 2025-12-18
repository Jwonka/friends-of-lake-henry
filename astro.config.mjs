// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
    site: 'https://friendsoflakehenry.com',
    integrations: [sitemap()],
    output: "server",
    adapter: cloudflare({
        workerEntryPoint: { path: "src/worker.ts" },
    }),
    image: {
        service: { entrypoint: "astro/assets/services/noop" },
    },
});
