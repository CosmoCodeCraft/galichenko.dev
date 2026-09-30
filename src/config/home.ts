import type { Locale } from "../i18n";
export type HomeSection =
  | "hero"
  | "featuredProjects"
  | "experienceSignal"
  | "selectedResearch"
  | "contact";
export const homeSections: { id: HomeSection; enabled: boolean }[] = [
  { id: "hero", enabled: true },
  { id: "featuredProjects", enabled: true },
  { id: "experienceSignal", enabled: true },
  { id: "selectedResearch", enabled: true },
  { id: "contact", enabled: true },
];
export const homeCopy: Partial<
  Record<Locale, { role: string; specialty: string; intro: string }>
> = {
  en: {
    role: "Software Engineering MSc student",
    specialty: "DevOps · Systems Engineering",
    intro:
      "I work on software and physical systems — from computer vision experiments to service integration. Currently studying System and Software Engineering at HSE University.",
  },
};
