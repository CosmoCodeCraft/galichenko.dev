import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const textExtensions = new Set([
  ".astro",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".svg",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);
const scanRoots = ["src", ".github", "scripts"];
const rootFiles = [
  "astro.config.mjs",
  "audit.config.mjs",
  "eslint.config.js",
  "package.json",
  "tsconfig.json",
];
const excludedPrefixes = ["src/citation/locales/", "src/citation/styles/"];
const excludedFiles = new Set(["scripts/security-check.mjs"]);

const rules = [
  {
    name: "Russian passport number",
    pattern: /\b(?:\d{2}[ \u00a0]\d{2}|\d{4})[ \u00a0]\d{6}\b/g,
  },
  {
    name: "Russian telephone number",
    pattern: /(?:\+7|8)[\s(-]*\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/g,
  },
  {
    name: "Telegram link",
    pattern: /\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+/gi,
  },
  {
    name: "private-key PEM block",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  },
  {
    name: "GitHub personal access token",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g,
  },
  {
    name: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: "JSON Web Token",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
];

function snilsChecksumIsValid(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const sum = [...digits.slice(0, 9)].reduce(
    (total, digit, index) => total + Number(digit) * (9 - index),
    0,
  );
  let checksum = sum < 100 ? sum : sum <= 101 ? 0 : sum % 101;
  if (checksum === 100) checksum = 0;
  return checksum === Number(digits.slice(9));
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function displayMatch(value) {
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

function inspectText(path, text) {
  const findings = [];
  const add = (name, match) => {
    findings.push({
      path,
      line: lineNumberAt(text, match.index),
      name,
      sample: displayMatch(match[0]),
    });
  };

  for (const match of text.matchAll(
    /\b\d{3}[- ]?\d{3}[- ]?\d{3}[ -]?\d{2}\b/g,
  )) {
    if (snilsChecksumIsValid(match[0]))
      add("valid-looking SNILS number", match);
  }

  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) add(rule.name, match);
  }

  const credentialPattern =
    /["']?(?:password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|access[_-]?token|auth[_-]?token|token)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi;
  for (const match of text.matchAll(credentialPattern)) {
    const lineEnd = text.indexOf("\n", match.index);
    const line = text.slice(
      text.lastIndexOf("\n", match.index) + 1,
      lineEnd === -1 ? text.length : lineEnd,
    );
    const value = match[1].toLowerCase();
    const isPublicCloudflareBeacon =
      path === "src/layouts/BaseLayout.astro" &&
      line.includes("data-cf-beacon");
    const isPlaceholder =
      /^(?:example|placeholder|redacted|changeme|your[_-])/.test(value);
    if (!isPublicCloudflareBeacon && !isPlaceholder)
      add("hard-coded credential", match);
  }

  return findings;
}

async function collectTextFiles(directory) {
  const entries = await readdir(join(repositoryRoot, directory), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) continue;
    if (entry.isDirectory()) files.push(...(await collectTextFiles(path)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name)))
      files.push(path);
  }
  return files;
}

async function inspectWebp(path) {
  const data = await readFile(join(repositoryRoot, path));
  if (
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return [
      {
        path,
        line: 1,
        name: "invalid WebP container",
        sample: "invalid header",
      },
    ];
  }
  const findings = [];
  for (let offset = 12; offset + 8 <= data.length;) {
    const chunk = data.toString("ascii", offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (chunk === "EXIF" || chunk === "XMP ") {
      findings.push({
        path,
        line: 1,
        name: `${chunk.trim()} metadata in WebP`,
        sample: chunk.trim(),
      });
    }
    offset += 8 + size + (size % 2);
  }
  return findings;
}

async function main() {
  const textFiles = (await Promise.all(scanRoots.map(collectTextFiles)))
    .flat()
    .concat(rootFiles)
    .filter((path) => !excludedFiles.has(path))
    .sort();
  const findings = [];
  for (const path of textFiles) {
    findings.push(
      ...inspectText(path, await readFile(join(repositoryRoot, path), "utf8")),
    );
  }

  const collectWebp = async (directory) => {
    const entries = await readdir(join(repositoryRoot, directory), {
      withFileTypes: true,
    });
    const paths = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) paths.push(...(await collectWebp(path)));
      else if (entry.isFile() && extname(entry.name).toLowerCase() === ".webp")
        paths.push(path);
    }
    return paths;
  };
  for (const path of await collectWebp("src/assets"))
    findings.push(...(await inspectWebp(path)));

  if (findings.length > 0) {
    console.error("Security/PII check failed:");
    for (const finding of findings) {
      console.error(
        `- ${finding.path}:${finding.line}: ${finding.name} (${finding.sample})`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Security/PII check passed (${textFiles.length} text files; first-party WebP metadata checked).`,
  );
}

await main();
