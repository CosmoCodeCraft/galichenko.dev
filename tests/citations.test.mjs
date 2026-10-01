import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatCitations } from "../src/utils/citations.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const assets = {
  styles: {
    gost: await read("src/citation/styles/gost-r-7-0-5-2008.csl"),
    ieee: await read("src/citation/styles/ieee.csl"),
    apa: await read("src/citation/styles/apa-7.csl"),
  },
  locales: {
    ru: await read("src/citation/locales/locales-ru-RU.xml"),
    en: await read("src/citation/locales/locales-en-US.xml"),
  },
};

async function publication(slug) {
  const source = await read(`src/content/publications/en/${slug}.md`);
  const frontmatter = source
    .match(/^---\n([\s\S]*?)\n---/)[1]
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(frontmatter);
}

function assertComplete(citations, entryType) {
  for (const value of Object.values(citations)) {
    assert.ok(value.length > 20);
    assert.doesNotMatch(value, /undefined|null/);
  }
  assert.match(citations.bibtex, new RegExp(`^@${entryType}\\{`));
}

test("formats a multi-author conference paper", async () => {
  const citations = formatCitations(
    await publication("generative-ai-physical-education"),
    assets,
  );
  assertComplete(citations, "inproceedings");
  assert.equal(
    citations.gost,
    "1. Александрова Г. А. и др. Применение генеративного искусственного интеллекта для обучения физической культуре // Перспективные направления в области физической культуры, спорта и туризма. Нижневартовск: Нижневартовский государственный университет, 2025. С. 17–21.",
  );
  assert.match(citations.ieee, /G\. A\. Alexandrova, S\. A\. Galichenko/);
  assert.match(citations.apa, /Alexandrova, G\. A\., Galichenko, S\. A\./);
});

test("formats a single-author conference paper", async () => {
  const citations = formatCitations(
    await publication("patriotism-physical-culture"),
    assets,
  );
  assertComplete(citations, "inproceedings");
  assert.equal(
    citations.gost,
    "1. Галиченко С. А. Формирование чувства патриотизма среди молодёжи при помощи физической культуры и спорта // Методики и практики патриотического воспитания молодежи. Москва: Московский Политех, 2023. С. 176–178.",
  );
});

test("formats a conference abstract", async () => {
  const citations = formatCitations(
    await publication("growing-plants-on-mars"),
    assets,
  );
  assertComplete(citations, "inproceedings");
  assert.equal(
    citations.gost,
    "1. Галиченко С. А., Багрянцев О. М. Аппарат для исследования возможности выращивания сельскохозяйственных растений на Марсе // Гагаринские чтения — 2023. Москва: Издательство «Перо», 2023. С. 484–485.",
  );
});

test("formats a journal article", async () => {
  const citations = formatCitations(
    await publication("triboluminescence"),
    assets,
  );
  assertComplete(citations, "article");
  assert.equal(
    citations.gost,
    "1. Галиченко С. А. Явление триболюминесценции. Что заставляет кристаллы светиться // Юный ученый. 2021. № 11 (52). С. 43–46.",
  );
});

test("keeps UralCon accepted and does not invent missing fields", async () => {
  const citations = formatCitations(
    await publication("uralcon-aeroponic-nozzle-monitoring"),
    assets,
  );
  assertComplete(citations, "inproceedings");
  assert.match(citations.gost, /Galichenko S\. A\., Pikalov E\. V\./);
  assert.match(citations.ieee, /Accepted for publication/);
  assert.match(citations.apa, /Accepted for publication/);
  assert.match(citations.bibtex, /note = \{Accepted for publication\}/);
  assert.doesNotMatch(citations.bibtex, /pages|publisher|doi/i);
});

test("formats INFO-2026 as accepted without invented proceedings data", async () => {
  const citations = formatCitations(
    await publication("aeroponic-irrigation-system-architecture"),
    assets,
  );
  assertComplete(citations, "inproceedings");
  assert.match(citations.gost, /Галиченко С\. А\., Пикалов Е\. В\./);
  assert.match(citations.ieee, /Accepted for publication/);
  assert.match(citations.apa, /Accepted for publication/);
  assert.match(citations.bibtex, /note = \{Accepted for publication\}/);
  assert.doesNotMatch(citations.bibtex, /pages|publisher|doi/i);
});
