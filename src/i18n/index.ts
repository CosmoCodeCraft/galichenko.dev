import { en } from "./en";
import { ru } from "./ru";
export type Locale = "en" | "ru";
export const enabledLocales: Locale[] = ["en"];
export const defaultLocale: Locale = "en";
export const dictionaries = { en, ru };
export function t(locale: Locale) {
  return dictionaries[locale];
}
export function route(locale: Locale, path = "") {
  return `/${locale === defaultLocale ? "" : locale + "/"}${path.replace(/^\//, "")}`;
}
export function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    ...(value.length > 4 ? { month: "short" as const } : {}),
    timeZone: "UTC",
  }).format(
    new Date(
      value.length === 4
        ? value + "-01-01"
        : value.length === 7
          ? value + "-01"
          : value,
    ),
  );
}
