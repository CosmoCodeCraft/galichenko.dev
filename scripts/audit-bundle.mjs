import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { load } from "cheerio";
import { zipSync, unzipSync } from "fflate";
import astroConfig from "../astro.config.mjs";
import config from "../audit.config.mjs";
import {
  compare,
  routeFromFile,
  inspectHtml,
  selectRepresentatives,
  collectPeople,
  assertSafeArtifact,
} from "./audit-lib.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const shortCommit = git("rev-parse", "--short=7", "HEAD");
const branch = git("branch", "--show-current") || null;
const dirty = Boolean(git("status", "--porcelain", "--untracked-files=normal"));
const timestamp = new Date().toISOString();
const site = astroConfig.site;
if (!site) throw new Error("Astro production site URL is required");
// Export only a credential-free public GitHub repository URL, never raw remotes.
const remote = git("remote", "get-url", "origin");
const repositoryPath = remote.match(
  /^(?:https:\/\/(?:[^/]*@)?github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/,
)?.[1];
if (!repositoryPath)
  throw new Error(
    "Expected a public GitHub origin; update the repository URL sanitizer for a new host",
  );
const repository = `https://github.com/${repositoryPath}`;
const bundleName = `galichenko-dev-audit-${shortCommit}`;
const output = resolve("audit-output");
await mkdir(output, { recursive: true });
// A per-run directory prevents old screenshots leaking into a fresh archive.
const temporary = await mkdtemp(join(tmpdir(), "galichenko-audit-"));
const artifacts = new Map();
let preview;
let browser;
let previewLog = "";
let stagingZip;
const fail = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function run(command, args) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${command} ${args.join(" ")} failed (${code})`)),
    );
  });
}
async function walk(directory, prefix = "") {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => compare(a.name, b.name),
  )) {
    // Never follow symlinks into arbitrary local files.
    if (entry.isDirectory())
      result.push(
        ...(await walk(join(directory, entry.name), `${prefix}${entry.name}/`)),
      );
    else if (entry.isFile()) result.push(`${prefix}${entry.name}`);
    else throw new Error(`Unsupported build entry: ${prefix}${entry.name}`);
  }
  return result;
}
async function artifact(path, data) {
  assertSafeArtifact(path);
  fail(!artifacts.has(path), `Duplicate artifact: ${path}`);
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  fail(bytes.length > 0, `Empty artifact: ${path}`);
  const destination = join(temporary, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  artifacts.set(path, {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const json = (path, value) =>
  artifact(path, `${JSON.stringify(value, null, 2)}\n`);
async function stopPreview() {
  if (!preview || preview.exitCode !== null || preview.signalCode !== null)
    return;
  const stopped = new Promise((done) => preview.once("exit", done));
  preview.kill("SIGTERM");
  const timer = setTimeout(() => preview.kill("SIGKILL"), 3000);
  await stopped;
  clearTimeout(timer);
}
try {
  await run("pnpm", ["build"]);
  const files = await walk(resolve("dist"));
  const pages = [];
  const excluded = [];
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const html = await readFile(join("dist", file));
    const route = routeFromFile(file);
    const page = inspectHtml(html.toString(), route, site, config);
    if (/\b(noindex|none)\b/i.test(page.metadata.robots ?? "")) {
      excluded.push({
        route,
        reason: "emitted robots meta disallows indexing",
      });
      continue;
    }
    const htmlArtifact = `pages/html/${file}`;
    const textArtifact = `pages/text/${file.replace(/\.html$/, ".txt")}`;
    await artifact(htmlArtifact, html);
    await artifact(textArtifact, page.text);
    pages.push({ ...page, htmlArtifact, textArtifact, screenshots: [] });
  }
  pages.sort((a, b) => compare(a.metadata.route, b.metadata.route));
  const byRoute = new Map(pages.map((p) => [p.metadata.route, p]));
  fail(pages.length && byRoute.has("/"), "No public pages or Home missing");
  fail(byRoute.size === pages.length, "Duplicate generated routes");
  const representatives = selectRepresentatives(pages, config.representatives);
  const captures = config.captures.map((capture) => ({
    ...capture,
    routes: [
      ...new Set([
        ...capture.routes,
        ...(capture.representatives ?? []).map((key) => {
          fail(representatives[key], `Unknown representative: ${key}`);
          return representatives[key];
        }),
      ]),
    ].sort(compare),
  }));
  for (const capture of captures)
    for (const route of capture.routes)
      fail(byRoute.has(route), `Configured visual route missing: ${route}`);

  const discovery = [];
  async function copyDiscovery(file) {
    fail(files.includes(file), `Missing discovery file: ${file}`);
    if (discovery.includes(`discovery/${file}`)) return;
    const bytes = await readFile(join("dist", file));
    await artifact(`discovery/${file}`, bytes);
    discovery.push(`discovery/${file}`);
    if (file.endsWith(".xml")) {
      const $ = load(bytes.toString(), { xmlMode: true });
      fail($("sitemapindex, urlset").length, `Invalid sitemap: ${file}`);
      for (const loc of $("sitemapindex > sitemap > loc").toArray()) {
        const url = new URL($(loc).text(), site);
        fail(
          url.origin === new URL(site).origin,
          "Sitemap references an external host",
        );
        await copyDiscovery(decodeURIComponent(url.pathname.slice(1)));
      }
    }
  }
  await copyDiscovery("robots.txt");
  await copyDiscovery("sitemap-index.xml");
  // Include any additional integration-generated sitemap files, even unreferenced ones.
  for (const file of files.filter((f) => /(^|\/)sitemap[^/]*\.xml$/.test(f)))
    await copyDiscovery(file);
  discovery.sort(compare);
  fail(
    discovery.filter((f) => f.endsWith(".xml")).length >= 2,
    "Sitemap index or child sitemap missing",
  );
  await json(
    "metadata/index.json",
    pages.map((p) => p.metadata),
  );
  await json("metadata/person.json", { entities: collectPeople(pages) });
  await json(
    "metadata/internal-links.json",
    Object.fromEntries(pages.map((p) => [p.metadata.route, p.links])),
  );

  // Install only the locked Playwright Chromium build; a cached installation is reused.
  try {
    await access(chromium.executablePath());
  } catch {
    await run("pnpm", ["exec", "playwright", "install", "chromium"]);
  }
  const socket = createServer();
  await new Promise((done, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", done);
  });
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  const origin = `http://127.0.0.1:${port}`;
  preview = spawn(
    process.execPath,
    [
      join(dirname(require.resolve("astro/package.json")), "astro.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  preview.on("error", (error) => {
    previewLog += error.message;
  });
  for (const stream of [preview.stdout, preview.stderr])
    stream.on("data", (data) => {
      previewLog = (previewLog + data).slice(-4000);
    });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null)
      throw new Error(`Preview failed: ${previewLog}`);
    try {
      ready = (await fetch(origin, { signal: AbortSignal.timeout(500) })).ok;
    } catch {
      /* Wait for startup. */
    }
    if (ready) break;
    await delay(100);
  }
  fail(ready, `Preview did not start: ${previewLog}`);
  browser = await chromium.launch();
  const screenshotCounts = {};
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: capture.viewport,
      deviceScaleFactor: 1,
      colorScheme: capture.theme,
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
    // Block analytics/external traffic: all rendered site resources are local.
    await context.route("**/*", (request) =>
      new URL(request.request().url()).origin === origin
        ? request.continue()
        : request.abort(),
    );
    await context.addInitScript(
      ({ key, theme }) => localStorage.setItem(key, theme),
      { key: config.themeStorageKey, theme: capture.theme },
    );
    screenshotCounts[capture.name] = 0;
    try {
      for (const route of capture.routes) {
        const page = await context.newPage();
        const failures = [];
        page.on("response", (response) => {
          if (response.url().startsWith(origin) && response.status() >= 400)
            failures.push(
              `${response.status()} ${new URL(response.url()).pathname}`,
            );
        });
        page.on("requestfailed", (request) => {
          // Chromium cancels video range requests when the site pauses playback
          // for reduced motion; that is not a missing resource. HTTP errors
          // still fail through the response listener above.
          const cancelledMedia =
            request.resourceType() === "media" &&
            request.failure()?.errorText === "net::ERR_ABORTED";
          if (request.url().startsWith(origin) && !cancelledMedia)
            failures.push(
              `${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
            );
        });
        const response = await page.goto(`${origin}${route}`, {
          waitUntil: "networkidle",
        });
        fail(response?.ok(), `Failed screenshot page: ${route}`);
        await page.evaluate(async (fullPage) => {
          await document.fonts.ready;
          // Full-page captures need lazy images loaded. Viewport captures never scroll.
          if (fullPage) {
            for (
              let y = 0;
              y < document.documentElement.scrollHeight;
              y += window.innerHeight
            ) {
              window.scrollTo(0, y);
              await new Promise((done) =>
                requestAnimationFrame(() => requestAnimationFrame(done)),
              );
            }
            window.scrollTo(0, 0);
          }
          await Promise.all(
            [...document.images]
              .filter(
                (img) =>
                  fullPage ||
                  img.getBoundingClientRect().top < window.innerHeight,
              )
              .map(async (img) => {
                await img.decode();
                if (!img.naturalWidth) throw new Error("Image has no pixels");
              }),
          );
        }, capture.fullPage);
        fail(
          await page.evaluate(
            (theme) =>
              document.documentElement.dataset.theme === theme &&
              window.scrollY === 0,
            capture.theme,
          ),
          `Theme or scroll position mismatch: ${route}`,
        );
        fail(
          !failures.length,
          `Local resources failed on ${route}: ${failures.join(", ")}`,
        );
        const filename = `screenshots/${capture.name}/${createHash("sha256").update(route).digest("hex").slice(0, 16)}.png`;
        const png = await page.screenshot({ fullPage: capture.fullPage });
        fail(
          png.subarray(1, 4).toString() === "PNG" &&
            png.readUInt32BE(16) === capture.viewport.width &&
            (capture.fullPage ||
              png.readUInt32BE(20) === capture.viewport.height),
          `Invalid screenshot dimensions: ${route}`,
        );
        await artifact(filename, png);
        console.log(`Captured ${capture.name} ${route}`);
        byRoute.get(route).screenshots.push({
          category: capture.name,
          file: filename,
          viewport: capture.viewport,
          theme: capture.theme,
          fullPage: capture.fullPage,
          deviceScaleFactor: 1,
        });
        screenshotCounts[capture.name]++;
        await page.close();
      }
    } finally {
      await context.close();
    }
    console.log(
      `${capture.name}: ${screenshotCounts[capture.name]} screenshots`,
    );
  }
  const manifest = {
    bundleFormatVersion: 1,
    productionSiteUrl: site,
    repository,
    commit,
    shortCommit,
    branch,
    workingTreeDirty: dirty,
    generatedAt: timestamp,
    astroVersion: require("astro/package.json").version,
    nodeVersion: process.version,
    packageManagerVersion: `pnpm@${execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim()}`,
    playwrightVersion: require("@playwright/test/package.json").version,
    chromiumVersion: browser.version(),
    platform: process.platform,
    rendering: {
      reducedMotion: "reduce",
      locale: "en-US",
      timezone: "UTC",
      externalRequests: "blocked",
    },
    discoveredPageCount: pages.length,
    routes: pages.map((p) => p.metadata.route),
    excluded,
    representatives,
    pages: pages.map((p) => ({
      route: p.metadata.route,
      productionUrl: p.metadata.productionUrl,
      locale: p.metadata.language,
      category: p.category,
      html: p.htmlArtifact,
      text: p.textArtifact,
      screenshots: p.screenshots,
    })),
    screenshotCounts,
    discovery,
  };
  await artifact(
    "README.md",
    `# Static website snapshot\n\nThis is a static snapshot of sergeygalichenko.dev.\n\nCommit: ${commit}\nGeneration timestamp: ${timestamp}\n\n- pages/html/: unchanged raw HTML from the site's static build.\n- pages/text/: mechanical structural text extractions; CSS visibility is not inferred.\n- screenshots/: rendered build, with full-page and initial-viewport captures identified in the manifest. Viewport sizes: ${[...new Set(captures.map((capture) => `${capture.viewport.width} × ${capture.viewport.height}`))].join("; ")}; device scale factor: 1.\n- metadata/: machine-extracted page metadata, emitted Person entities (deduplicated with source routes), and internal links. Exact emitted JSON-LD strings are in index.json.\n- discovery/: generated/current robots and sitemap files.\n- manifest.json: production URLs, artifact mappings, rendering settings, and generation metadata.\n`,
  );
  // Inventory hashes cover every payload file except the manifest itself.
  manifest.artifacts = Object.fromEntries(
    [...artifacts.entries()].sort(([a], [b]) => compare(a, b)),
  );
  await json("manifest.json", manifest);
  const entries = {};
  for (const path of [...artifacts.keys()].sort(compare))
    entries[`${bundleName}/${path}`] = [
      await readFile(join(temporary, path)),
      {
        mtime: new Date("2000-01-01T00:00:00Z"),
        level: path.endsWith(".png") ? 0 : 6,
      },
    ];
  stagingZip = join(output, `.${bundleName}-${process.pid}.tmp`);
  await writeFile(stagingZip, zipSync(entries));
  const reopened = unzipSync(await readFile(stagingZip));
  fail(
    Object.keys(reopened).length === artifacts.size,
    "ZIP inventory mismatch",
  );
  for (const [name, bytes] of Object.entries(reopened)) {
    fail(name.startsWith(`${bundleName}/`), "Invalid ZIP root");
    const path = name.slice(bundleName.length + 1);
    assertSafeArtifact(path);
    fail(
      artifacts.has(path) &&
        createHash("sha256").update(bytes).digest("hex") ===
          artifacts.get(path).sha256,
      `ZIP payload mismatch: ${path}`,
    );
  }
  const zipPath = join(output, `${bundleName}.zip`);
  await rename(stagingZip, zipPath);
  console.log(
    JSON.stringify(
      {
        routes: pages.length,
        html: pages.length,
        text: pages.length,
        screenshots: screenshotCounts,
        metadata: pages.length,
        discovery,
        zip: `audit-output/${bundleName}.zip`,
        bytes: (await readFile(zipPath)).length,
        representatives,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await stopPreview();
  await rm(temporary, { recursive: true, force: true });
  if (stagingZip) await rm(stagingZip, { force: true });
}
