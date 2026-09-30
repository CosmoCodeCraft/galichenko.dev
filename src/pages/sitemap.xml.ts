import { site } from "../config/site";
import { enabledLocales, route } from "../i18n";
export function GET() {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${enabledLocales.map((l) => `<url><loc>${new URL(route(l), site.url).href}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
