import type { Locale } from "../i18n";

export interface CvPeriod {
  start: string;
  end?: string;
  present?: boolean;
}

export interface CvLink {
  label: string;
  path?: string;
  url?: string;
}

export interface CvProject {
  title: string;
  context: string;
  period: CvPeriod;
  bullets: string[];
  technologies: string[];
  links: CvLink[];
}

export interface CvExperience {
  organization: string;
  role: string;
  period: CvPeriod;
  bullets: string[];
}

export interface CvEducation {
  institution: string;
  degree: string;
  period: CvPeriod;
  programmeUrl: string;
  distinction?: string;
}

export interface CvContent {
  metaTitle: string;
  metaDescription: string;
  title: string;
  professionalTitle: string;
  pdfPath?: string;
  pdfLabel: string;
  pdfUnavailableLabel: string;
  summaryHeading: string;
  summary: string;
  skillsHeading: string;
  skills: Array<{ label: string; items: string[] }>;
  projectsHeading: string;
  projects: CvProject[];
  experienceHeading: string;
  experience: CvExperience[];
  educationHeading: string;
  education: CvEducation[];
  recognitionHeading: string;
  recognition: string[];
}

export const cvContent: Partial<Record<Locale, CvContent>> = {
  en: {
    metaTitle: "Sergey Galichenko — DevOps Engineer · Systems Integration",
    metaDescription:
      "Resume of Sergey Galichenko, a Software Engineering MSc student focused on DevOps and systems integration, with experience in Linux, Docker, service networking, PostgreSQL and infrastructure automation.",
    title: "Resume",
    professionalTitle: "DevOps Engineer · Systems Integration",
    pdfPath: undefined,
    pdfLabel: "Download PDF",
    pdfUnavailableLabel: "PDF coming soon",
    summaryHeading: "Summary",
    summary:
      "Software Engineering MSc student at HSE University with hands-on experience in Linux administration, containerized environments, service networking, PostgreSQL and deployment automation. Systems engineering background spanning infrastructure, embedded systems and integration of software with physical equipment.",
    skillsHeading: "Technical Skills",
    skills: [
      {
        label: "Infrastructure",
        items: ["Linux", "SSH", "Nginx", "UFW", "fail2ban"],
      },
      {
        label: "Containers & Integration",
        items: [
          "Docker",
          "Docker Compose",
          "container networking",
          "service discovery",
          "PostgreSQL",
          "FastAPI",
          "REST/HTTP APIs",
        ],
      },
      {
        label: "CI/CD & Automation",
        items: ["Git", "GitHub Actions", "Python", "Bash"],
      },
      { label: "Programming", items: ["Python", "Bash", "C/C++"] },
      {
        label: "Networking",
        items: ["TCP/IP", "HTTP", "WebSocket", "UART"],
      },
      {
        label: "Systems",
        items: ["Raspberry Pi", "ESP32", "ATmega328P"],
      },
    ],
    projectsHeading: "Projects",
    projects: [
      {
        title: "SIRD — Intelligent Data Recognition System",
        context: "DevOps / Integration Engineer · HSE University team project",
        period: { start: "2026", present: true },
        bullets: [
          "Built a reproducible three-service Docker Compose environment integrating independently containerized backend and recognition services with PostgreSQL.",
          "Resolved a service-to-service networking failure by replacing container-local localhost addressing with Docker DNS/service discovery; verified the complete HTTP request path through logs from both services.",
          "Verified PostgreSQL connectivity, SQL execution and data persistence across database-container recreation using a named Docker volume.",
          "Contributed to architecture review that reconsidered an early five-service decomposition in favour of fewer deployment boundaries and clearer responsibilities.",
        ],
        technologies: [
          "Docker",
          "Docker Compose",
          "PostgreSQL",
          "FastAPI",
          "Linux",
          "HTTP",
        ],
        links: [{ label: "View SIRD project", path: "projects/sird" }],
      },
      {
        title: "City Farm",
        context: "Engineer → Project Lead · Moscow Polytechnic University",
        period: { start: "2024-02", end: "2025-06" },
        bullets: [
          "Rebuilt and hardened a Raspberry Pi Linux server after identifying security issues; configured SSH key authentication, UFW, fail2ban and Nginx.",
          "Integrated ATmega328P / ESP32 control components with Raspberry Pi systems and implemented local web-based equipment control.",
          "Led a multidisciplinary team of approximately 12 people across control-system development, experiments, integration and project delivery.",
          "Automated experimental log processing, statistical analysis and graph generation with Python.",
        ],
        technologies: [
          "Linux",
          "Raspberry Pi",
          "Nginx",
          "Python",
          "C/C++",
          "ESP32",
          "ATmega328P",
        ],
        links: [
          { label: "View City Farm project", path: "projects/city-farm" },
        ],
      },
      {
        title: "galichenko.dev",
        context: "Software Engineering · Personal project",
        period: { start: "2026-09", present: true },
        bullets: [
          "Designed and deployed a static Astro / TypeScript portfolio and research archive with a custom domain and GitHub Pages hosting.",
          "Automated validation and deployment through GitHub Actions, including linting, type checking and static build before publication.",
        ],
        technologies: ["Astro", "TypeScript", "GitHub Actions", "GitHub Pages"],
        links: [
          {
            label: "View galichenko.dev project",
            path: "projects/galichenko-dev",
          },
          {
            label: "View source on GitHub",
            url: "https://github.com/CosmoCodeCraft/galichenko.dev",
          },
          { label: "View live site", url: "https://sergeygalichenko.dev" },
        ],
      },
    ],
    experienceHeading: "Experience",
    experience: [
      {
        organization: "Pixel Programming & Robotics School",
        role: "Programming Instructor",
        period: { start: "2025-12", end: "2026-08" },
        bullets: [
          "Taught programming and robotics, prepared development environments and troubleshot software, dependency and network issues during classes.",
        ],
      },
      {
        organization: "Moscow Polytechnic University",
        role: "R&D Project Team Member · Administrative Operations",
        period: { start: "2023-09", end: "2024-11" },
        bullets: [
          "Automated repetitive data-processing and document workflows with Python, reducing manual work in recurring university processes.",
        ],
      },
    ],
    educationHeading: "Education",
    education: [
      {
        institution: "HSE University — Faculty of Computer Science",
        degree: "MSc, System and Software Engineering",
        period: { start: "2026", present: true },
        programmeUrl: "https://www.hse.ru/en/ma/se/",
      },
      {
        institution: "Moscow Polytechnic University",
        degree:
          "BSc, Control in Technical Systems — Electronic Control Systems",
        period: { start: "2022", end: "2026" },
        programmeUrl:
          "https://mospolytech.ru/postupayushchim/programmy-obucheniya/elektronnye-sistemy-upravleniya/",
        distinction: "Graduated with honours",
      },
    ],
    recognitionHeading: "Selected Recognition",
    recognition: [
      "Alfa-Future Scholarships — Winner, 2025",
      "PIK Award — Person of the Year in Research, 2025",
    ],
  },
};
