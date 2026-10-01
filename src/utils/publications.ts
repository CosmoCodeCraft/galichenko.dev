import type { CollectionEntry } from "astro:content";

export type Publication = CollectionEntry<"publications">;
export type PublicationAuthor = Publication["data"]["authorsOriginal"][number];

export function authorName(author: PublicationAuthor) {
  const family = author.family.trim().replace(/\s+/g, " ");
  const given = author.given?.trim().replace(/\s+/g, " ");
  return given ? `${family} ${given}` : family;
}

export function isSergey(author: PublicationAuthor) {
  return ["галиченко", "galichenko"].includes(author.family.toLowerCase());
}

export function publicationChronological(a: Publication, b: Publication) {
  return (
    b.data.year - a.data.year ||
    (b.data.conferenceDate ?? "").localeCompare(a.data.conferenceDate ?? "") ||
    a.data.slug.localeCompare(b.data.slug)
  );
}

export function groupPublicationsByYear(publications: Publication[]) {
  return publications.reduce<
    Array<{ year: number; publications: Publication[] }>
  >((groups, publication) => {
    const group = groups.at(-1);
    if (group?.year === publication.data.year) {
      group.publications.push(publication);
    } else {
      groups.push({ year: publication.data.year, publications: [publication] });
    }
    return groups;
  }, []);
}
