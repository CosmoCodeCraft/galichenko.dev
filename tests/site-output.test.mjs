import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio";

const siteUrl = "https://sergeygalichenko.dev";
const personId = `${siteUrl}/#person`;

async function page(route) {
  const path =
    route === "/"
      ? join(process.cwd(), "dist/index.html")
      : join(process.cwd(), "dist", route.replace(/^\//, ""), "index.html");
  return load(await readFile(path, "utf8"));
}

function jsonLd($) {
  return $('script[type="application/ld+json"]')
    .map((_, element) => JSON.parse($(element).text()))
    .get();
}

test("Home uses the requested project and research selections", async () => {
  const $ = await page("/");
  assert.equal(
    $(".hero .role").text().trim(),
    "DevOps & Systems Integration Engineer",
  );
  assert.deepEqual(
    $("#projects .project-card h3")
      .map((_, element) => $(element).text().trim())
      .get(),
    [
      "SIRD — Intelligent Data Recognition System",
      "City Farm",
      "Computer Vision for Aeroponic Irrigation Monitoring",
    ],
  );
  const cityFarmCard = $("#projects .project-card")
    .filter((_, element) => $(element).find("h3").text().trim() === "City Farm")
    .first();
  assert.match(
    cityFarmCard.find(".metadata").text(),
    /Engineer → Project Lead/,
  );
  assert.equal(
    cityFarmCard.find(".project-card-context").text().trim(),
    "Student engineering project · Moscow Polytechnic University",
  );
  assert.equal($("#projects .project-card-context").length, 1);
  assert.deepEqual(
    $("#research .publication-row h3")
      .map((_, element) => $(element).text().trim())
      .get(),
    [
      "A Computer Vision Approach to Automated Monitoring of Aeroponic Nozzle Operation",
      "Аппаратно-программная архитектура системы контроля орошения аэропонной установки с применением технического зрения",
    ],
  );
});

test("Home keeps its project anchor and external chrome links semantic", async () => {
  const $ = await page("/");
  const projectsTarget = $("#projects");
  assert.equal(projectsTarget.length, 1);
  assert.equal(projectsTarget.hasClass("home-projects-target"), true);
  assert.equal(projectsTarget.closest("section").attr("id"), undefined);
  assert.equal($('.scroll-hint[href="#projects"]').length, 1);

  const githubLinks = $('a[href="https://github.com/CosmoCodeCraft"]');
  assert.equal(githubLinks.length, 3);
  githubLinks.each((_, element) => {
    assert.equal($(element).attr("target"), "_blank");
    assert.equal($(element).attr("rel"), "noopener noreferrer");
  });
});

test("Projects archive retains City Farm's role and project context", async () => {
  const $ = await page("/projects/");
  const cityFarmEntry = $(".project-archive-entry")
    .filter((_, element) => $(element).find("h2").text().trim() === "City Farm")
    .first();
  assert.match(
    cityFarmEntry.find(".metadata").text(),
    /Engineer → Project Lead/,
  );
  assert.equal(
    cityFarmEntry.find(".project-card-context").text().trim(),
    "Student engineering project · Moscow Polytechnic University",
  );
  assert.equal($(".project-archive-entry .project-card-context").length, 1);
});

test("About separates professional experience from project leadership", async () => {
  const $ = await page("/about/");
  assert.deepEqual(
    $(".about-page > .about-section > h2")
      .map((_, element) => $(element).text().trim())
      .get(),
    [
      "Current focus",
      "Professional experience",
      "Project leadership",
      "From control systems to infrastructure",
      "Education",
      "Research & scientific community",
      "Selected recognition",
      "Selected mentions",
      "Engineering approach",
    ],
  );
  const professional = $(
    '[aria-labelledby="about-professional-experience-heading"]',
  ).text();
  const leadership = $(
    '[aria-labelledby="about-project-leadership-heading"]',
  ).text();
  assert.doesNotMatch(professional, /City Farm/);
  assert.match(leadership, /City Farm/);
  assert.match(leadership, /Student engineering project/);
});

test("SIRD omits the placeholder evidence section", async () => {
  const $ = await page("/projects/sird/");
  const headings = $(".project-case-study h2")
    .map((_, element) => $(element).text().trim())
    .get();
  assert.ok(!headings.includes("Evidence"));
});

test("detail pages emit project and publication structured data", async () => {
  const project$ = await page("/projects/sird/");
  const projectData = jsonLd(project$);
  assert.ok(projectData.some((entity) => entity["@id"] === personId));
  const project = projectData.find(
    (entity) => entity["@type"] === "CreativeWork",
  );
  assert.equal(project["@id"], `${siteUrl}/projects/sird/#project`);
  assert.deepEqual(project.contributor, { "@id": personId });

  const publication$ = await page(
    "/research/uralcon-aeroponic-nozzle-monitoring/",
  );
  const articleData = jsonLd(publication$);
  assert.ok(articleData.some((entity) => entity["@id"] === personId));
  const article = articleData.find(
    (entity) => entity["@type"] === "ScholarlyArticle",
  );
  assert.equal(
    article["@id"],
    `${siteUrl}/research/uralcon-aeroponic-nozzle-monitoring/#article`,
  );
  assert.equal(article.creativeWorkStatus, "Accepted for publication");
  assert.ok(!("datePublished" in article));
  assert.ok(
    article.author.some(
      (author) =>
        author["@id"] === personId && author.name.includes("Galichenko"),
    ),
  );
  assert.equal(article.about["@id"], `${siteUrl}/projects/vision/#project`);
});

test("collection descriptions and alternate URLs match canonical form", async () => {
  const descriptions = {
    "/projects/":
      "Engineering projects spanning systems integration, Linux infrastructure, embedded control, and applied research.",
    "/research/":
      "Publications and accepted work in engineering systems, aeroponics, computer vision, sustainable technologies, and interdisciplinary research.",
    "/notes/":
      "Short notes on engineering projects, research, education, and professional milestones.",
  };

  for (const [route, description] of Object.entries(descriptions)) {
    const $ = await page(route);
    assert.equal($('meta[name="description"]').attr("content"), description);
  }

  for (const route of [
    "/projects/",
    "/projects/sird/",
    "/research/uralcon-aeroponic-nozzle-monitoring/",
  ]) {
    const $ = await page(route);
    const canonical = $('link[rel="canonical"]').attr("href");
    const alternate = $('link[rel="alternate"][hreflang="en"]').attr("href");
    assert.equal(canonical, `${siteUrl}${route}`);
    assert.equal(alternate, canonical);
  }
});

test("production output self-hosts the required IBM Plex subsets", async () => {
  const $ = await page("/");
  assert.equal(
    $('link[rel="preload"][as="font"]').attr("href"),
    "/fonts/ibm-plex/IBMPlexSans-Regular-Latin1.woff2",
  );

  const stylesheetPaths = $('link[rel="stylesheet"]')
    .map((_, element) => $(element).attr("href"))
    .get()
    .filter((href) => href?.startsWith("/"));
  const css = (
    await Promise.all(
      stylesheetPaths.map((href) =>
        readFile(join(process.cwd(), "dist", href.slice(1)), "utf8"),
      ),
    )
  ).join("\n");
  const fontPaths = [
    ...new Set(
      [...css.matchAll(/url\(["']?(\/fonts\/ibm-plex\/[^)"']+\.woff2)/g)].map(
        (match) => match[1],
      ),
    ),
  ];

  assert.equal(fontPaths.length, 10);
  assert.match(css, /font-family:["']?IBM Plex Sans/);
  assert.match(css, /font-family:["']?IBM Plex Mono/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|use\.typekit/);

  const fontAssets = await Promise.all(
    fontPaths.map((path) =>
      readFile(join(process.cwd(), "dist", path.slice(1))),
    ),
  );
  assert.equal(
    fontAssets.reduce((total, asset) => total + asset.byteLength, 0),
    194892,
  );
});

test("temporary design comparison controls expose independent defaults", async () => {
  const $ = await page("/");
  const panel = $("[data-design-comparison]");
  assert.equal(panel.length, 1);
  assert.deepEqual(
    panel
      .find("[data-design-font-option]")
      .map((_, element) => ({
        value: $(element).attr("data-design-font-option"),
        pressed: $(element).attr("aria-pressed"),
      }))
      .get(),
    [
      { value: "plex", pressed: "true" },
      { value: "system", pressed: "false" },
    ],
  );
  assert.deepEqual(
    panel
      .find("[data-design-dark-option]")
      .map((_, element) => ({
        value: $(element).attr("data-design-dark-option"),
        pressed: $(element).attr("aria-pressed"),
      }))
      .get(),
    [
      { value: "graphite", pressed: "true" },
      { value: "navy", pressed: "false" },
    ],
  );
  assert.equal(panel.find("[data-hero-visual-option]").length, 0);
  const inlineScripts = $("script:not([src])")
    .map((_, element) => $(element).text())
    .get()
    .join("\n");
  assert.match(inlineScripts, /sg-design-font/);
  assert.match(inlineScripts, /sg-design-dark/);
  assert.doesNotMatch(inlineScripts, /sg-hero-visual/);
});
