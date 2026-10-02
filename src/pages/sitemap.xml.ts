import { site } from "../config/site";
import { enabledLocales, route } from "../i18n";
import { entries, entryPath } from "../utils/content";
export async function GET() {
  const publicPaths = ["", "projects", "research", "notes", "about"];
  const detailPaths = (await entries())
    .filter(
      (entry) =>
        entry.collection === "publications" ||
        entry.collection === "projects" ||
        entry.collection === "notes",
    )
    .map(entryPath);
  const urls = [
    ...enabledLocales.flatMap((locale) =>
      publicPaths.map((path) => route(locale, path)),
    ),
    ...detailPaths,
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${new URL(path, site.url).href}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
