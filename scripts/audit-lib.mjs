import { load } from "cheerio";

export const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function routeFromFile(file) {
  return `/${file}`.replace(/\/index\.html$/, "/");
}
export function normalizeLink(href, base, site) {
  try {
    const url = new URL(href, base);
    if (url.origin !== new URL(site).origin) return null;
    let path = url.pathname.replace(/\/index\.html$/, "/");
    if (!path.endsWith("/") && !/\.[^/]+$/.test(path)) path += "/";
    return path;
  } catch {
    return null;
  }
}

// A deliberately small structural text serializer, not a summarizer. CSS-dependent
// visibility is not inferred; repetitions and closed-dialog content remain.
export function extractText($, url) {
  function render(node, depth = 0, pre = false) {
    if (node.type === "text")
      return pre ? node.data : node.data.replace(/\s+/g, " ");
    const tag = node.name;
    if (!tag || ["script", "style", "template"].includes(tag)) return "";
    const el = $(node);
    const children = () =>
      (node.children ?? []).map((n) => render(n, depth, pre)).join("");
    if (tag === "pre")
      return `\n\n${(node.children ?? []).map((n) => render(n, depth, true)).join("")}\n\n`;
    if (tag === "a") {
      const href = el.attr("href");
      let target = href;
      try {
        target = new URL(href, url).href;
      } catch {
        /* Preserve malformed targets verbatim. */
      }
      return href ? `[${children().trim()}](${target})` : children();
    }
    if (tag === "img")
      return el.attr("alt") ? ` [Image: ${el.attr("alt")}] ` : "";
    if (/^h[1-6]$/.test(tag))
      return `\n\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === "ul" || tag === "ol") {
      let index = Number(el.attr("start") ?? 1);
      return (
        "\n" +
        (node.children ?? [])
          .filter((n) => n.name === "li")
          .map((li) => {
            const marker = tag === "ol" ? `${index++}.` : "-";
            return `${"  ".repeat(depth)}${marker} ${(li.children ?? [])
              .map((n) => render(n, depth + 1, pre))
              .join("")
              .trim()}\n`;
          })
          .join("") +
        "\n"
      );
    }
    if (tag === "br") return "\n";
    if (tag === "tr") return `${children().trim()}\n`;
    if (tag === "td" || tag === "th") return `${children().trim()}\t`;
    const value = children();
    if (
      [
        "p",
        "div",
        "section",
        "article",
        "header",
        "footer",
        "main",
        "nav",
        "aside",
        "blockquote",
        "figure",
        "figcaption",
        "dl",
        "dt",
        "dd",
        "table",
        "dialog",
      ].includes(tag)
    )
      return `\n\n${value.trim()}\n\n`;
    if (["button", "label", "option", "summary"].includes(tag))
      return ` ${value} `;
    return value;
  }
  return `Title: ${$("title").text()}\nSource: ${url}\n\n${render($("body")[0])
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export function inspectHtml(html, route, site, config) {
  const $ = load(html);
  const productionUrl = new URL(route, site).href;
  const meta = (selector) => $(selector).attr("content");
  const metadata = {
    productionUrl,
    route,
    title: $("title").text(),
    description: meta('meta[name="description"]'),
    canonical: $('link[rel="canonical"]').attr("href"),
    language: $("html").attr("lang"),
    robots: meta('meta[name="robots"]'),
    hreflang: $('link[rel="alternate"][hreflang]')
      .toArray()
      .map((n) => ({
        language: $(n).attr("hreflang"),
        href: $(n).attr("href"),
      })),
    openGraph: Object.fromEntries(
      ["title", "description", "type", "url"].map((key) => [
        key,
        meta(`meta[property="og:${key}"]`),
      ]),
    ),
    // Raw strings retain exact emitted JSON-LD, including escaping and whitespace.
    jsonLd: $('script[type="application/ld+json"]')
      .toArray()
      .map((n) => $(n).text()),
  };
  const dates = {};
  for (const [key, rule] of Object.entries(config.representatives)) {
    if (!$(rule.selector).length) continue;
    const el = $(rule.selector).find(rule.dateSelector).first();
    const raw = rule.dateAttribute ? el.attr(rule.dateAttribute) : el.text();
    const date = rule.datePattern
      ? raw?.match(new RegExp(rule.datePattern))?.[1]
      : raw;
    if (!/^\d{4}(-\d{2})?(-\d{2})?$/.test(date ?? ""))
      throw new Error(`Missing declared ${key} date: ${route}`);
    dates[key] = date;
  }
  return {
    metadata,
    dates,
    category: Object.entries(config.categories).find(
      ([, selector]) => $(selector).length,
    )?.[0],
    text: extractText($, productionUrl),
    links: [
      ...new Set(
        $("a[href]")
          .toArray()
          .map((n) => normalizeLink($(n).attr("href"), productionUrl, site))
          .filter(Boolean),
      ),
    ].sort(compare),
  };
}

export function selectRepresentatives(pages, rules) {
  const selected = {};
  for (const [category, rule] of Object.entries(rules)) {
    const candidates = pages.filter((p) => p.dates[category]);
    if (!candidates.length) throw new Error(`No dated ${category} pages found`);
    for (const choice of rule.choices) {
      if (!["latest", "earliest"].includes(choice))
        throw new Error(`Unknown selection: ${choice}`);
      const sorted = [...candidates].sort(
        (a, b) =>
          (choice === "latest" ? -1 : 1) *
            compare(a.dates[category], b.dates[category]) ||
          compare(a.metadata.route, b.metadata.route),
      );
      selected[`${category}:${choice}`] = sorted[0].metadata.route;
    }
  }
  return selected;
}

const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && !Array.isArray(v) && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => compare(a, b)))
      : v,
  );
export function collectPeople(pages) {
  const people = new Map();
  function visit(value, route) {
    if (!value || typeof value !== "object") return;
    if ([value["@type"]].flat().includes("Person")) {
      const key = stable(value);
      if (!people.has(key)) people.set(key, { entity: value, routes: [] });
      const entry = people.get(key);
      if (!entry.routes.includes(route)) entry.routes.push(route);
    }
    Object.values(value).forEach((v) => {
      if (typeof v === "object") visit(v, route);
    });
  }
  for (const p of pages)
    for (const raw of p.metadata.jsonLd) {
      try {
        visit(JSON.parse(raw), p.metadata.route);
      } catch {
        /* Invalid JSON-LD remains in the raw metadata index. */
      }
    }
  return [...people.values()];
}

// All ZIP entries must originate in the explicit artifact allowlist.
export function assertSafeArtifact(path) {
  if (
    !/^(pages\/(html|text)\/[^\\]+\.(html|txt)|screenshots\/[a-z-]+\/[a-f0-9]+\.png|discovery\/[^\\]+\.(txt|xml)|metadata\/(index|person|internal-links)\.json|manifest\.json|README\.md)$/.test(
      path,
    ) ||
    path
      .split("/")
      .some(
        (part) =>
          part === ".." || part.startsWith(".") || part === "node_modules",
      ) ||
    path.includes(":")
  )
    throw new Error(`Unsafe artifact path: ${path}`);
}
