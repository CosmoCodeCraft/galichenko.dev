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
    role: "DevOps & Systems Integration Engineer",
    specialty:
      "MSc student in System and Software Engineering at HSE University.",
    intro:
      "My background spans embedded systems, Linux infrastructure and applied computer vision. I now focus on service integration and infrastructure: getting services to communicate correctly, persist data, and work together as a complete system.",
  },
};
