import type { Locale } from "../i18n";

interface AboutLink {
  label: string;
  url: string;
}

interface AboutInternalLink {
  label: string;
  path: string;
}

interface AboutArea {
  title: string;
  description: string;
}

interface AboutExperience {
  period: string;
  role: string;
  organization: string;
  paragraphs: string[];
  link?: AboutInternalLink;
}

interface AboutEducation {
  period: string;
  institution: string;
  programme: string[];
  note?: string;
}

interface AboutRecognition {
  year: string;
  title: string;
  distinction: string;
  distinctionLanguage?: string;
  context: string;
  evidence: AboutLink;
}

interface AboutMention {
  date: string;
  source: string;
  title: string;
  titleLanguage: string;
  context: string;
  link: AboutLink;
}

interface AboutPrinciple {
  title: string;
  paragraphs: string[];
}

export interface AboutContent {
  title: string;
  metaDescription: string;
  introduction: string[];
  portraitLabel: string;
  areasHeading: string;
  areas: AboutArea[];
  experienceHeading: string;
  experience: AboutExperience[];
  trajectoryHeading: string;
  trajectory: string[];
  educationHeading: string;
  education: AboutEducation[];
  researchHeading: string;
  researchIntroduction: string[];
  researchLinkLabel: string;
  communityHeading: string;
  community: string[];
  recognitionHeading: string;
  recognition: AboutRecognition[];
  mentionsHeading: string;
  mentions: AboutMention[];
  principlesHeading: string;
  principles: AboutPrinciple[];
  continuationHeading: string;
}

export const aboutContent: Partial<Record<Locale, AboutContent>> = {
  en: {
    title: "About",
    metaDescription:
      "About Sergey Galichenko: systems integration, infrastructure, embedded systems, applied computer vision, professional experience, education and research.",
    introduction: [
      "I'm Sergey Galichenko, a Software Engineering MSc student at HSE University working across systems integration, infrastructure, embedded systems and applied computer vision.",
      "My engineering background started with automation and physical systems, where software had to interact with sensors, actuators and real processes. Over time that work expanded into Linux infrastructure, service integration, computer vision research and software architecture.",
      "Today I am primarily interested in DevOps and systems integration: the part of software engineering where independently developed components have to communicate, deploy reproducibly and behave predictably as a system.",
    ],
    portraitLabel: "Portrait photograph",
    areasHeading: "Areas of work",
    areas: [
      {
        title: "DevOps & Systems Integration",
        description:
          "Service integration, reproducible environments, Linux infrastructure and deployment-oriented engineering.",
      },
      {
        title: "Embedded & Physical Systems",
        description:
          "Microcontrollers, single-board computers, sensors, control systems and hardware-software integration.",
      },
      {
        title: "Computer Vision & Applied Research",
        description:
          "Classical image processing, experimental validation and engineering research.",
      },
    ],
    experienceHeading: "Experience",
    experience: [
      {
        period: "December 2025 — Present",
        role: "Programming Instructor",
        organization: "Pixel Programming & Robotics School",
        paragraphs: [
          "I teach programming and robotics in small student groups, prepare development environments and help diagnose software, dependency and network-related problems that arise during classes.",
          "The role combines technical troubleshooting with explaining systems clearly enough for other people to work with them.",
        ],
      },
      {
        period: "February 2024 — June 2025",
        role: "Engineer → Project Lead",
        organization: "City Farm · Moscow Polytechnic University",
        paragraphs: [
          "I progressed from technical research and hands-on engineering to leading a multidisciplinary student team of approximately 12 people.",
          "My responsibilities expanded to automated control systems, experimental work, coordination across several cultivation installations, task planning, project presentations and onboarding new team members.",
          "The project became an important transition point from working with individual technical components to being responsible for how a larger engineering system and team fit together.",
        ],
        link: {
          label: "View City Farm project",
          path: "projects/city-farm",
        },
      },
      {
        period: "September 2023 — November 2024",
        role: "Administrative operations & automation",
        organization: "Moscow Polytechnic University",
        paragraphs: [
          "Alongside administrative work, I used Python to automate repetitive data-processing and document workflows.",
          "This was one of my first practical experiences of using software not as an academic exercise, but to remove repetitive work from a real organisational process.",
        ],
      },
    ],
    trajectoryHeading: "From control systems to software engineering",
    trajectory: [
      "I began with control systems and embedded engineering, where software was inseparable from the physical process it controlled.",
      "City Farm added another layer: Linux infrastructure, remote administration, integration between controllers and higher-level software, experimental work and eventually project leadership.",
      "The aeroponic irrigation monitoring project pushed that experience toward computer vision and research. I designed a three-level hardware-software system, implemented image-processing methods and validated them experimentally.",
      "During my master's studies, projects such as SIRD have shifted my focus further toward software boundaries, containerized services, deployment and integration.",
      "The technologies changed, but the underlying interest remained consistent: understanding how separate components interact and turn into a reliable system.",
    ],
    educationHeading: "Education",
    education: [
      {
        period: "2026 — Present",
        institution: "HSE University",
        programme: [
          "MSc · System and Software Engineering",
          "Faculty of Computer Science",
        ],
      },
      {
        period: "2022 — 2026",
        institution: "Moscow Polytechnic University",
        programme: [
          "BSc · Control in Technical Systems",
          "Electronic Control Systems",
        ],
        note: "Graduated with honours",
      },
    ],
    researchHeading: "Research & recognition",
    researchIntroduction: [
      "My research work has focused mainly on engineering systems, controlled-environment agriculture and computer vision.",
      "Recent work includes papers accepted for publication at UralCon 2026 and INFO-2026, both related to aeroponic irrigation monitoring.",
      "Earlier work spans automated cultivation systems, sustainable technologies and several interdisciplinary topics.",
    ],
    researchLinkLabel: "View research archive",
    communityHeading: "Student Scientific Society",
    community: [
      "Alongside project and research work, I was involved in the Student Scientific Society at Moscow Polytechnic and served as one of its deputy chairs.",
      "The role included representing the university at student-research events and contributing to activities intended to involve more students in research.",
    ],
    recognitionHeading: "Recognition",
    recognition: [
      {
        year: "2025",
        title: "PIK Award",
        distinction: "«Персона года в научно-исследовательской деятельности»",
        distinctionLanguage: "ru",
        context: "Moscow Polytechnic annual student achievement award.",
        evidence: {
          label: "Official award announcement",
          url: "https://mospolytech.ru/news/v-moskovskom-politekhe-pozdravili-pobediteley-premii-pik/",
        },
      },
      {
        year: "2024",
        title: "TechnoMentors",
        distinction: "Winner · «Лучший пост»",
        context:
          "Recognition within the nationwide TechnoMentors project for work related to engineering mentorship and outreach.",
        evidence: {
          label: "Official TechnoMentors results",
          url: "https://academy.sk.ru/news/315",
        },
      },
    ],
    mentionsHeading: "Selected mentions",
    mentions: [
      {
        date: "14 February 2025",
        source: "Moscow Polytechnic University",
        title:
          "Студент Сергей Галиченко: «Интерес к науке возник, когда я столкнулся с явлением триболюминесценции»",
        titleLanguage: "ru",
        context:
          "A profile interview about my path into research, City Farm, engineering mentorship, student scientific activity and the projects I was working on at Moscow Polytechnic.",
        link: {
          label: "Read the interview",
          url: "https://mospolytech.ru/news/student-sergey-galichenko-interes-k-nauke-voznik-kogda-ya-stolknulsya-s-yavleniem-tribolyuminestsents/",
        },
      },
      {
        date: "21 April 2023",
        source: "Moscow Polytechnic University",
        title:
          "Молодые ученые Московского Политеха презентовали разработку на научной конференции",
        titleLanguage: "ru",
        context:
          "Coverage of an early engineering research project presented at the Gagarin Readings conference at Moscow Aviation Institute.",
        link: {
          label: "Read the conference story",
          url: "https://mospolytech.ru/news/molodye-uchenye-moskovskogo-politekha-prezentovali-razrabotku-na-nauchnoy-konferentsii/",
        },
      },
    ],
    principlesHeading: "How I work",
    principles: [
      {
        title: "Start with the problem and the system boundary",
        paragraphs: [
          "I prefer understanding what a component is responsible for before introducing another service, abstraction or infrastructure tool.",
          "Architecture should follow an actual system need rather than the desire to use a particular technology.",
        ],
      },
      {
        title: "Separate plans from evidence",
        paragraphs: [
          "I try to distinguish clearly between what is planned, what has been implemented and what has actually been verified.",
          "That applies equally to experimental research, service integration and deployment.",
        ],
      },
      {
        title: "Prefer observable results",
        paragraphs: [
          "Logs, tests, measurements and reproducible behaviour tell more about a system than a technology list alone.",
          "When possible, I want an engineering claim to be supported by something that can be inspected or repeated.",
        ],
      },
    ],
    continuationHeading: "Continue exploring",
  },
};
