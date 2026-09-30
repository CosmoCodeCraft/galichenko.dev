import CSL from "citeproc";

export interface CitationAuthor {
  family: string;
  given?: string;
}

export interface CitationPublication {
  id: string;
  slug: string;
  publicationType:
    "conference-paper" | "conference-abstract" | "journal-article";
  titleOriginal: string;
  titleEnglish?: string;
  authorsOriginal: CitationAuthor[];
  authorsEnglish?: CitationAuthor[];
  year: number;
  sourceTitle?: string;
  sourceTitleEnglish?: string;
  publicationPlace?: string;
  publisher?: string;
  pages?: string;
  issue?: string;
  conferenceTitle?: string;
  conferenceDate?: string;
  status: "published" | "accepted" | "submitted" | "unknown";
  externalUrl?: string;
  doi?: string;
}

export interface CitationAssets {
  styles: { gost: string; ieee: string; apa: string };
  locales: { ru: string; en: string };
}

export interface CitationSet {
  gost: string;
  ieee: string;
  apa: string;
  bibtex: string;
}

function cslType(type: CitationPublication["publicationType"]) {
  return type === "journal-article" ? "article-journal" : "paper-conference";
}

function toCslItem(publication: CitationPublication, international: boolean) {
  const authors =
    international && publication.authorsEnglish?.length
      ? publication.authorsEnglish
      : publication.authorsOriginal;
  const title =
    international && publication.titleEnglish
      ? publication.titleEnglish
      : publication.titleOriginal;
  const source =
    international && publication.sourceTitleEnglish
      ? publication.sourceTitleEnglish
      : publication.sourceTitle;
  return {
    id: publication.id,
    type: cslType(publication.publicationType),
    title,
    author: authors,
    issued: { "date-parts": [[publication.year]] },
    "container-title": source,
    "event-title":
      publication.conferenceTitle && publication.conferenceTitle !== source
        ? publication.conferenceTitle
        : undefined,
    "publisher-place": publication.publicationPlace,
    publisher: publication.publisher,
    page: publication.pages?.replace("–", "-"),
    issue: publication.issue,
    DOI: publication.doi,
    URL: publication.externalUrl,
    status:
      publication.status === "accepted"
        ? "Accepted for publication"
        : undefined,
  };
}

function renderCsl(
  publication: CitationPublication,
  style: string,
  locale: string,
  international: boolean,
) {
  const item = toCslItem(publication, international);
  const system = {
    retrieveLocale: () => locale,
    retrieveItem: () => item,
  };
  const engine = new CSL.Engine(
    system,
    style,
    international ? "en-US" : "ru-RU",
    true,
  );
  engine.setOutputFormat("text");
  engine.updateItems([publication.id]);
  const bibliography = engine.makeBibliography();
  if (!bibliography) throw new Error(`Unable to cite ${publication.id}`);
  return bibliography[1][0].replace(/\s+/g, " ").trim();
}

function bibtexValue(value: string) {
  return value
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}");
}

function renderBibtex(publication: CitationPublication) {
  const international = Boolean(publication.titleEnglish);
  const authors =
    international && publication.authorsEnglish?.length
      ? publication.authorsEnglish
      : publication.authorsOriginal;
  const title = publication.titleEnglish ?? publication.titleOriginal;
  const source = publication.sourceTitleEnglish ?? publication.sourceTitle;
  const entryType =
    publication.publicationType === "journal-article"
      ? "article"
      : "inproceedings";
  const fields: Array<[string, string | undefined]> = [
    [
      "author",
      authors.length
        ? authors
            .map((author) =>
              author.given
                ? `${author.family}, ${author.given}`
                : author.family,
            )
            .join(" and ")
        : undefined,
    ],
    ["title", title],
    [entryType === "article" ? "journal" : "booktitle", source],
    ["year", String(publication.year)],
    ["pages", publication.pages?.replace("–", "--")],
    ["publisher", publication.publisher],
    ["address", publication.publicationPlace],
    ["number", publication.issue],
    ["doi", publication.doi],
    ["url", publication.externalUrl],
    [
      "note",
      publication.status === "accepted"
        ? "Accepted for publication"
        : undefined,
    ],
  ];
  const body = fields
    .filter((field): field is [string, string] => Boolean(field[1]))
    .map(([key, value]) => `  ${key} = {${bibtexValue(value)}},`)
    .join("\n");
  return `@${entryType}{${publication.slug.replaceAll("-", "_")},\n${body}\n}`;
}

export function formatCitations(
  publication: CitationPublication,
  assets: CitationAssets,
): CitationSet {
  return {
    gost: renderCsl(publication, assets.styles.gost, assets.locales.ru, false),
    ieee: renderCsl(publication, assets.styles.ieee, assets.locales.en, true),
    apa: renderCsl(publication, assets.styles.apa, assets.locales.en, true),
    bibtex: renderBibtex(publication),
  };
}
