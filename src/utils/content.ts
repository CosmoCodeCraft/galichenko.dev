import { getCollection, type CollectionEntry } from "astro:content";
import { enabledLocales, route, type Locale } from "../i18n";
export type Entry =
  | CollectionEntry<"projects">
  | CollectionEntry<"publications">
  | CollectionEntry<"notes">;
export async function entries() {
  return [
    ...(await getCollection("projects")),
    ...(await getCollection("publications")),
    ...(await getCollection("notes")),
  ].filter((e) => !e.data.draft && enabledLocales.includes(e.data.locale));
}
export function entryPath(e: Entry) {
  return route(
    e.data.locale,
    `${e.collection === "publications" ? "research" : e.collection}/${e.data.slug}`,
  );
}
export async function featured<C extends "projects" | "publications">(
  collection: C,
  locale: Locale,
) {
  return (await getCollection(collection))
    .filter((e) => !e.data.draft && e.data.locale === locale && e.data.featured)
    .sort(
      (a, b) =>
        (a.data.featuredOrder ?? Infinity) - (b.data.featuredOrder ?? Infinity),
    )
    .slice(0, 3);
}
export function chronological(a: Entry, b: Entry) {
  const key = (e: Entry) =>
    "year" in e.data
      ? String(e.data.year)
      : "date" in e.data
        ? e.data.date
        : e.data.present
          ? "9999"
          : (e.data.endDate ?? e.data.startDate ?? "");
  return key(b).localeCompare(key(a)) || a.data.slug.localeCompare(b.data.slug);
}
