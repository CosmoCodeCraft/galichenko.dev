import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const [type, slug] = process.argv.slice(2);
const types = ["note", "project", "publication"];

if (!types.includes(type) || !/^[a-z0-9-]+$/.test(slug ?? "")) {
  console.error("Usage: pnpm content:new <note|project|publication> <slug>");
  process.exit(1);
}

const prompt = createInterface({ input, output });
const ask = async (question, { optional = false, validate } = {}) => {
  while (true) {
    const value = (await prompt.question(`${question}: `)).trim();
    if ((optional && !value) || (value && (!validate || validate(value))))
      return value;
    console.log("Please enter a valid value.");
  }
};
const choice = (values) => (value) => values.includes(value);
const date = (value) => /^\d{4}(-\d{2})?(-\d{2})?$/.test(value);
const yes = (value) => value === "yes" || value === "no";
const csv = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const authors = (value) =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [family, given] = item.split("|").map((part) => part.trim());
      return { family, ...(given ? { given } : {}) };
    });

const root = process.cwd();
const plural = `${type}s`;
const directory = join(root, "src", "content", plural, "en", slug);
const extension = type === "publication" ? "md" : "mdx";
const file = join(directory, `index.${extension}`);

try {
  await access(file);
  console.error(`Refusing to overwrite ${relative(root, file)}`);
  process.exit(1);
} catch {
  // The target is available.
}

const common = {
  id: slug,
  slug,
  locale: "en",
  translationKey: slug,
  draft: true,
};

let data;
try {
  if (type === "note") {
    data = {
      ...common,
      title: await ask("Title"),
      summary: await ask("Summary"),
      date: await ask("Date (YYYY, YYYY-MM, or YYYY-MM-DD)", {
        validate: date,
      }),
      tags: csv(await ask("Tags, comma-separated", { optional: true })),
      featured: false,
    };
  }

  if (type === "publication") {
    data = {
      ...common,
      publicationType: await ask(
        "Type (conference-paper, conference-abstract, or journal-article)",
        {
          validate: choice([
            "conference-paper",
            "conference-abstract",
            "journal-article",
          ]),
        },
      ),
      titleOriginal: await ask("Original title"),
      languageOriginal: await ask("Original language (en or ru)", {
        validate: choice(["en", "ru"]),
      }),
      titleEnglish:
        (await ask("Official English title", { optional: true })) || undefined,
      authorsOriginal: authors(
        await ask("Authors in source order (Family|Initials; Family|Initials)"),
      ),
      year: Number(
        await ask("Year", { validate: (value) => /^\d{4}$/.test(value) }),
      ),
      sourceTitle:
        (await ask("Source / venue", { optional: true })) || undefined,
      status: await ask("Status (published, accepted, submitted, or unknown)", {
        validate: choice(["published", "accepted", "submitted", "unknown"]),
      }),
      featured: false,
      keywordsOriginal: [],
      keywordsEnglish: [],
    };
    const localPdf = await ask("Local PDF URL (/publications/pdfs/file.pdf)", {
      optional: true,
      validate: (value) =>
        /^\/publications\/pdfs\/[a-z0-9-]+\.pdf$/.test(value),
    });
    const optionalUrl = async (label) =>
      (await ask(label, {
        optional: true,
        validate: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
      })) || undefined;
    Object.assign(data, {
      ...(localPdf ? { localPdf, pdfKind: "publication-extract" } : {}),
      externalFullTextUrl: await optionalUrl("External full-text URL"),
      publisherUrl: await optionalUrl("Publisher URL"),
      elibraryUrl: await optionalUrl("eLIBRARY URL"),
      ednUrl: await optionalUrl("EDN URL"),
    });
  }

  if (type === "project") {
    const coverSource = await ask("Path to an existing cover image");
    await access(coverSource);
    const coverName = `cover${extname(coverSource).toLowerCase()}`;
    data = {
      ...common,
      title: await ask("Title"),
      summary: await ask("Summary"),
      status: await ask("Status (completed, ongoing, or planned)", {
        validate: choice(["completed", "ongoing", "planned"]),
      }),
      startDate:
        (await ask("Start date (optional)", {
          optional: true,
          validate: date,
        })) || null,
      present: (await ask("Present? (yes or no)", { validate: yes })) === "yes",
      featured: false,
      role: await ask("Role"),
      tags: csv(await ask("Tags, comma-separated")),
      technologies: csv(
        await ask("Implemented technologies, comma-separated", {
          optional: true,
        }),
      ).map((name) => ({ name, state: "implemented" })),
      cover: {
        src: `./assets/${coverName}`,
        alt: await ask("Cover alt text (blank only if decorative)", {
          optional: true,
        }),
        role: "cover",
        cropAllowed: false,
      },
    };
    await mkdir(join(directory, "assets"), { recursive: true });
    await copyFile(coverSource, join(directory, "assets", coverName));
  }

  await mkdir(directory, { recursive: true });
  await writeFile(file, `---\n${JSON.stringify(data, null, 2)}\n---\n\n`);
  console.log(
    `Created ${relative(root, file)} as draft. Review it before publishing.`,
  );
} finally {
  prompt.close();
}
