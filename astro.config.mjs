import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
export default defineConfig({
  site: "https://sergeygalichenko.dev",
  output: "static",
  // All currently generated HTML routes are indexable. Drafts and disabled
  // locales are already excluded by getStaticPaths.
  integrations: [mdx(), sitemap()],
});
