import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectHtml,
  routeFromFile,
  normalizeLink,
  selectRepresentatives,
  collectPeople,
  assertSafeArtifact,
} from "../scripts/audit-lib.mjs";
const config = { representatives: {}, categories: {} };
test("HTML extraction preserves metadata, structural text, repetition and links", () => {
  const raw = '{ "@type": "Person", "name": "A & B" }';
  const page = inspectHtml(
    `<html lang="en"><head><title>A &amp; B</title><meta name="description" content="Exact"><link rel="canonical" href="https://example.com/a/"><script type="application/ld+json">${raw}</script></head><body><h1>One</h1><h2>Two</h2><p>Repeat</p><p>Repeat</p><ol start="3"><li>Alpha<ul><li>Nested</li></ul></li></ol><table><tr><th>Key</th><td>Value</td></tr></table><a href="../b#fragment">Next</a><a href="mailto:a@example.com">Mail</a><script>secretImplementation()</script></body></html>`,
    "/a/",
    "https://example.com",
    config,
  );
  assert.equal(page.metadata.title, "A & B");
  assert.equal(page.metadata.description, "Exact");
  assert.deepEqual(page.metadata.jsonLd, [raw]);
  assert.match(page.text, /# One\n\n## Two/);
  assert.match(page.text, /Repeat\n\nRepeat/);
  assert.match(page.text, /3\. Alpha\n {2}- Nested/);
  assert.match(page.text, /Key\tValue/);
  assert.match(page.text, /\[Next\]\(https:\/\/example.com\/b#fragment\)/);
  assert.doesNotMatch(page.text, /secretImplementation/);
  assert.deepEqual(page.links, ["/b/"]);
});
test("route normalization retains file routes and removes trivial variants", () => {
  assert.equal(routeFromFile("index.html"), "/");
  assert.equal(routeFromFile("new/page/index.html"), "/new/page/");
  assert.equal(routeFromFile("404.html"), "/404.html");
  assert.equal(routeFromFile("myindex.html"), "/myindex.html");
  assert.equal(
    normalizeLink(
      "/a/index.html?q=1#x",
      "https://example.com/",
      "https://example.com",
    ),
    "/a/",
  );
  assert.equal(
    normalizeLink("/file.pdf", "https://example.com/", "https://example.com"),
    "/file.pdf",
  );
  assert.equal(
    normalizeLink(
      "https://other.test/a",
      "https://example.com/",
      "https://example.com",
    ),
    null,
  );
});
test("new dated pages automatically change representative selection with stable ties", () => {
  const rules = { note: { choices: ["latest", "earliest"] } };
  const pages = [
    ["/b/", "2026-02"],
    ["/a/", "2026-02"],
    ["/old/", "2024"],
  ].map(([route, date]) => ({ metadata: { route }, dates: { note: date } }));
  assert.deepEqual(selectRepresentatives(pages, rules), {
    "note:latest": "/a/",
    "note:earliest": "/old/",
  });
  pages.push({ metadata: { route: "/new/" }, dates: { note: "2027" } });
  assert.equal(selectRepresentatives(pages, rules)["note:latest"], "/new/");
  assert.throws(() => selectRepresentatives([], rules));
});
test("Person deduplication handles graphs, key order and preserves distinct emitted entities", () => {
  const pages = [
    {
      metadata: {
        route: "/",
        jsonLd: ['{"@graph":[{"@type":"Person","name":"A"}]}'],
      },
    },
    {
      metadata: {
        route: "/a/",
        jsonLd: [
          '{"name":"A","@type":"Person"}',
          '{"name":"B","@type":"Person"}',
        ],
      },
    },
  ];
  const result = collectPeople(pages);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].routes, ["/", "/a/"]);
});
test("artifact allowlist rejects secret, traversal and unrelated payloads", () => {
  for (const path of [
    ".git/config",
    ".env",
    "node_modules/x.js",
    "pages/html/../../.env.html",
    "pages/html/.git/index.html",
    "pages/html/node_modules/index.html",
    "logs/build.log",
    "assets/x.js.map",
    "/manifest.json",
  ])
    assert.throws(() => assertSafeArtifact(path));
  for (const path of [
    "manifest.json",
    "pages/html/new/index.html",
    "pages/text/new/index.txt",
    "metadata/person.json",
    "discovery/sitemap-2.xml",
  ])
    assert.doesNotThrow(() => assertSafeArtifact(path));
});
