import type { Locale } from "../i18n";
export interface Experience {
  id: string;
  locale: Locale;
  role: string;
  organization: string;
  startDate?: string;
  endDate?: string;
}
export interface Education {
  id: string;
  locale: Locale;
  institution: string;
  programme: string;
  startDate?: string;
  endDate?: string;
}
export interface Achievement {
  id: string;
  locale: Locale;
  title: string;
  date?: string;
  evidenceUrl?: string;
}
export const experiences: Experience[] = [
  {
    id: "pixel",
    locale: "en",
    role: "Programming Instructor",
    organization: "Pixel Programming & Robotics School",
  },
  {
    id: "automation",
    locale: "en",
    role: "Automation / Python",
    organization: "Moscow Polytechnic University",
  },
];
export const education: Education[] = [
  {
    id: "hse",
    locale: "en",
    institution: "HSE University",
    programme: "System and Software Engineering MSc",
  },
];
export const achievements: Achievement[] = [];
