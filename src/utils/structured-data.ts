import type { CollectionEntry } from "astro:content";
import { route } from "../i18n";
import { authorName, isSergey } from "./publications";
import { absoluteSiteUrl } from "./urls";

export type StructuredData = Record<string, unknown>;

export const PERSON_ID = "https://sergeygalichenko.dev/#person";

function projectStructuredData(
  project: CollectionEntry<"projects">,
  canonicalUrl: string,
): StructuredData {
  const p = project.data;
  const status = {
    completed: "Completed",
    ongoing: "Ongoing",
    planned: "Planned",
  }[p.status];

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${canonicalUrl}#project`,
    name: p.title,
    description: p.detailSummary ?? p.summary,
    url: canonicalUrl,
    inLanguage: p.locale,
    keywords: p.tags,
    creativeWorkStatus: p.detailStatus ?? status,
    contributor: { "@id": PERSON_ID },
  };
}

function publicationStructuredData(
  publication: CollectionEntry<"publications">,
  canonicalUrl: string,
): StructuredData {
  const p = publication.data;
  const venue = p.sourceTitle ?? p.conferenceTitle;
  const keywords = [...p.keywordsOriginal, ...p.keywordsEnglish].filter(
    (keyword, index, all) => all.indexOf(keyword) === index,
  );
  const relatedProjectUrl = p.relatedProject
    ? absoluteSiteUrl(route(p.locale, `projects/${p.relatedProject}`))
    : undefined;
  const status = {
    published: "Published",
    accepted: "Accepted for publication",
    submitted: "Submitted",
    unknown: "Unknown",
  }[p.status];

  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "@id": `${canonicalUrl}#article`,
    name: p.titleOriginal,
    headline: p.titleEnglish ?? p.titleOriginal,
    url: canonicalUrl,
    abstract: p.abstractEnglish ?? p.abstractOriginal,
    inLanguage: p.languageOriginal,
    keywords,
    author: p.authorsOriginal.map((author) =>
      isSergey(author)
        ? {
            "@type": "Person",
            "@id": PERSON_ID,
            name: authorName(author),
          }
        : { "@type": "Person", name: authorName(author) },
    ),
    creativeWorkStatus: status,
    datePublished: p.status === "published" ? String(p.year) : undefined,
    isPartOf: venue ? { "@type": "CreativeWork", name: venue } : undefined,
    publisher: p.publisher
      ? { "@type": "Organization", name: p.publisher }
      : undefined,
    about: relatedProjectUrl
      ? {
          "@type": "CreativeWork",
          "@id": `${relatedProjectUrl}#project`,
          url: relatedProjectUrl,
        }
      : undefined,
  };
}

export function structuredDataForEntry(
  entry:
    | CollectionEntry<"projects">
    | CollectionEntry<"publications">
    | CollectionEntry<"notes">,
  canonicalUrl: string,
): StructuredData | undefined {
  if (entry.collection === "projects")
    return projectStructuredData(entry, canonicalUrl);
  if (entry.collection === "publications")
    return publicationStructuredData(entry, canonicalUrl);
  return undefined;
}
