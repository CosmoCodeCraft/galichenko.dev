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
    role: "DevOps · Systems Integration",
    specialty: "MSc student in System and Software Engineering at HSE University.",
    intro:
      "I’ve worked with embedded systems, Linux infrastructure, and computer vision across engineering and research projects. What interests me most is the integration work that turns separate components into systems that can be tested, deployed, and operated reliably.",
  },
};
