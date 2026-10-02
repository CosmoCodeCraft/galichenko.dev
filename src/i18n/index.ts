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
export function formatExactDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function dateValue(value: string) {
  return new Date(
    value.length === 4
      ? `${value}-01-01`
      : value.length === 7
        ? `${value}-01`
        : value,
  );
}

export function formatNoteDate(
  value: string,
  locale: Locale,
  includeYear = true,
) {
  if (locale === "en") {
    const [year, month, day] = value.split("-");
    if (!month) return year;
    const monthLabel =
      [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][Number(month) - 1] ?? month;
    return [
      day ? Number(day) : undefined,
      monthLabel,
      includeYear ? year : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(" ");
  }

  return new Intl.DateTimeFormat(locale, {
    ...(includeYear || value.length === 4 ? { year: "numeric" as const } : {}),
    ...(value.length > 4 ? { month: "short" as const } : {}),
    ...(value.length > 7 ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(dateValue(value));
}

export function noteDateRange(
  start: string,
  end: string | undefined,
  locale: Locale,
) {
  if (!end || start === end)
    return { start: formatNoteDate(start, locale), end: undefined };

  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const compactStart = sameYear && start.length > 4;
  const startLabel =
    sameMonth && start.length > 7 && end.length > 7
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
          day: "numeric",
          timeZone: "UTC",
        }).format(dateValue(start))
      : formatNoteDate(start, locale, !compactStart);

  return {
    start: startLabel,
    end: formatNoteDate(end, locale),
  };
}
