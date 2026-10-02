import type { Locale } from "../i18n";

interface AboutLink {
  label: string;
  url: string;
}

interface AboutInternalLink {
  label: string;
  path: string;
}

interface AboutFocusState {
  label: string;
  description: string;
  items: string[];
}

interface AboutFocusArea {
  title: string;
  paragraphs: string[];
  states?: AboutFocusState[];
  scope?: string[];
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
  programme: string;
  programmeUrl: string;
  details: string[];
  note?: string;
}

interface AboutCommunity {
  role: string;
  organization: string;
  paragraphs: string[];
}

interface AboutRecognition {
  year: string;
  title: string;
  distinction: string;
  context: string;
  evidence?: AboutLink;
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
  focusHeading: string;
  focus: AboutFocusArea[];
  experienceHeading: string;
  experience: AboutExperience[];
  trajectoryHeading: string;
  trajectory: string[];
  educationHeading: string;
  education: AboutEducation[];
  researchHeading: string;
  researchIntroduction: string[];
  researchLinkLabel: string;
  community: AboutCommunity;
  recognitionHeading: string;
  recognition: AboutRecognition[];
  mentionsHeading: string;
  mentions: AboutMention[];
  principlesHeading: string;
  principles: AboutPrinciple[];
}

export const aboutContent: Partial<Record<Locale, AboutContent>> = {
  en: {
    title: "About",
    metaDescription:
      "About Sergey Galichenko: DevOps, platform engineering and systems integration with a control and embedded engineering foundation.",
    introduction: [
      "I'm Sergey Galichenko, a Software Engineering MSc student at HSE University focused on DevOps, platform engineering and systems integration.",
      "My focus is the part of engineering where independently developed components have to work as one system: services need to communicate, data has to persist, deployments have to be repeatable, and failures have to be diagnosable.",
      "I came to software engineering through control and embedded systems, so I tend to reason across layers — from devices and networking to application services and infrastructure. Today I am moving that systems perspective further into containerized services, CI/CD, orchestration and observability.",
    ],
    portraitLabel: "Sergey Galichenko",
    focusHeading: "Current focus",
    focus: [
      {
        title: "DevOps & Platform Engineering",
        paragraphs: [
          "I am developing the infrastructure side of my work around containerized environments, deployment automation, orchestration and observability.",
        ],
        states: [
          {
            label: "Verified / working with now",
            description:
              "In the current SIRD project, the verified baseline includes:",
            items: [
              "Docker",
              "Docker Compose",
              "Linux / container networking",
              "Service integration",
              "PostgreSQL",
            ],
          },
          {
            label: "Current direction / work in progress",
            description: "The next platform layer is being developed around:",
            items: [
              "GitLab CI/CD",
              "Kubernetes",
              "Helm / Helmfile",
              "Prometheus",
              "Grafana",
              "Tempo",
            ],
          },
        ],
      },
      {
        title: "Systems Integration",
        paragraphs: [
          "I work with the boundaries between services: HTTP APIs, container networking, service discovery, data persistence and failure diagnosis.",
          "I am particularly interested in the point where individually working components have to become a reproducible, debuggable system.",
        ],
        scope: [
          "HTTP APIs",
          "Container networking",
          "Service discovery",
          "Data persistence",
          "Failure diagnosis",
        ],
      },
      {
        title: "Systems & Embedded Foundation",
        paragraphs: [
          "My earlier work with microcontrollers, Raspberry Pi, sensors, actuators and control systems gave me experience with software that interacts with real processes and constraints.",
          "That background remains useful when tracing problems across multiple layers rather than treating an application, network or device in isolation.",
        ],
        scope: [
          "Microcontrollers",
          "Raspberry Pi",
          "Sensors & actuators",
          "Control systems",
        ],
      },
    ],
    experienceHeading: "Experience",
    experience: [
      {
        period: "December 2025 — August 2026",
        role: "Programming Teacher",
        organization: "PIXEL Programming & Robotics School",
        paragraphs: [
          "I taught programming and robotics to children and teenagers in small groups, prepared development environments, and diagnosed software, dependency and network-related problems during classes.",
          "The role strengthened two practical skills that transfer directly to engineering work: troubleshooting under time constraints and explaining technical systems clearly enough for another person to work with them.",
        ],
      },
      {
        period: "February 2023 — June 2025",
        role: "Engineer → Project Lead",
        organization: "City Farm · Moscow Polytechnic University",
        paragraphs: [
          "I progressed from hands-on engineering work to leading a multidisciplinary student team that grew to 12 people.",
          "My responsibilities covered control systems, experimental work, Linux-based infrastructure, task planning, project delivery, onboarding and coordination across several cultivation installations.",
          "Moving into the lead role taught me to think beyond individual components and take responsibility for how the technical work, people and project constraints fit together.",
        ],
        link: {
          label: "View City Farm project",
          path: "projects/city-farm",
        },
      },
      {
        period: "September 2023 — November 2024",
        role: "Engineering & Technical Staff · Core R&D Project Team",
        organization: "Moscow Polytechnic University",
        paragraphs: [
          "I worked within the engineering and technical staff as a member of the core team delivering a university R&D project.",
          "As part of that experience, I used Python to automate recurring data-processing and document workflows.",
          "This was one of my first experiences of using software to remove routine work from a real organisational process rather than only solving an academic programming task.",
        ],
      },
    ],
    trajectoryHeading: "From control systems to platform engineering",
    trajectory: [
      "I started in control systems, where software had to coordinate sensors, actuators, timing and physical processes.",
      "City Farm expanded that perspective into Linux administration, remote access, integration and responsibility for a larger system and team.",
      "My bachelor research used computer vision as a diagnostic tool for an aeroponic system. The important part for my current engineering direction was not computer vision as a specialisation, but designing the interfaces between control, computing and operator layers and validating the complete workflow experimentally.",
      "In my master's programme, SIRD moves the same systems interest into software infrastructure: service boundaries, containers, persistence, deployment, orchestration and observability.",
      "The technologies changed, but the underlying problem remained the same: how to make separate components work together predictably as one system.",
    ],
    educationHeading: "Education",
    education: [
      {
        period: "2026 — Present",
        institution: "HSE University",
        programme: "MSc · System and Software Engineering",
        programmeUrl: "https://www.hse.ru/en/ma/se",
        details: ["Faculty of Computer Science"],
      },
      {
        period: "2022 — 2026",
        institution: "Moscow Polytechnic University",
        programme: "BSc · Control in Technical Systems",
        programmeUrl:
          "https://mospolytech.ru/postupayushchim/programmy-obucheniya/elektronnye-sistemy-upravleniya/",
        details: ["Electronic Control Systems"],
        note: "Graduated with honours",
      },
    ],
    researchHeading: "Research & scientific community",
    researchIntroduction: [
      "Research has been one way for me to validate engineering ideas with explicit methods, experiments and evidence.",
      "My recent work includes papers accepted for publication at UralCon 2026 and INFO-2026 on aeroponic irrigation monitoring and its hardware-software architecture.",
      "Earlier work includes automated cultivation systems, sustainable technologies and several interdisciplinary topics.",
    ],
    researchLinkLabel: "View research archive",
    community: {
      role: "Deputy Chair",
      organization:
        "Student Scientific Society · Moscow Polytechnic University",
      paragraphs: [
        "I served as Deputy Chair of the Student Scientific Society, represented the university at student-research events and worked on activities intended to involve more students in research.",
      ],
    },
    recognitionHeading: "Selected recognition",
    recognition: [
      {
        year: "2025",
        title: "Alfa-Future Scholarships",
        distinction: "Winner",
        context: "Competitive scholarship programme by Alfa-Bank.",
      },
      {
        year: "2025",
        title: "PIK Award",
        distinction: "Person of the Year in Research",
        context: "Moscow Polytechnic annual student achievement award.",
        evidence: {
          label: "Official award announcement",
          url: "https://mospolytech.ru/news/v-moskovskom-politekhe-pozdravili-pobediteley-premii-pik/",
        },
      },
      {
        year: "2024",
        title: "TechnoMentors",
        distinction:
          "Winner · Interregional Competition for the Best Mentor of Children's and Youth Technology Projects",
        context:
          "Competition organised within the nationwide TechnoMentors initiative.",
        evidence: {
          label: "Moscow Polytechnic profile",
          url: "https://mospolytech.ru/news/student-sergey-galichenko-interes-k-nauke-voznik-kogda-ya-stolknulsya-s-yavleniem-tribolyuminestsents/",
        },
      },
      {
        year: "2026",
        title: "Finatlon",
        distinction: "II-degree Laureate",
        context:
          "International scientific and practical conference for young researchers and specialists in sustainable development, investment and financial risks.",
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
          "A profile interview about my path into research, City Farm, technical mentorship, student scientific activity and the projects I was working on at Moscow Polytechnic.",
        link: {
          label: "Read the interview",
          url: "https://mospolytech.ru/news/student-sergey-galichenko-interes-k-nauke-voznik-kogda-ya-stolknulsya-s-yavleniem-tribolyuminestsents/",
        },
      },
      {
        date: "4 April 2024",
        source: "Russian State University for the Humanities",
        title:
          "В РГГУ прошел круглый стол по теме «Студенческая наука в РГГУ: традиции и новации исследовательских школ» в рамках Гуманитарных чтений РГГУ «Корни и крона»",
        titleLanguage: "ru",
        context:
          "Official coverage of a student-research round table where I presented an approach to involving students in research through meetings with young scientists. The talk was «Вовлечение студентов в науку через встречи с молодыми учёными».",
        link: {
          label: "View the event coverage",
          url: "https://www.rsuh.ru/news/sovet-molodykh-uchenykh-rggu/v-rggu-proshel-kruglyy-stol-po-teme-studencheskaya-nauka-v-rggu-traditsii-i-novatsii-issledovatelskikh-shkol-v-ramkakh-gumanitarnykh-chteniy-rggu-korni-i-krona/",
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
    principlesHeading: "Engineering approach",
    principles: [
      {
        title: "Define boundaries before adding infrastructure",
        paragraphs: [
          "A new service or infrastructure tool should solve a real problem: ownership, deployment, isolation, scaling or observability.",
          "I prefer simplifying a system before automating unnecessary complexity.",
        ],
      },
      {
        title: "Verify the end-to-end path",
        paragraphs: [
          "A healthy container or successful unit test does not prove that the system works as a whole.",
          "I prefer tracing real requests across service boundaries, checking networking, persistence and logs, and verifying the behaviour that a user or another system actually depends on.",
        ],
      },
      {
        title: "Make systems reproducible and observable",
        paragraphs: [
          "Configuration and deployment should be repeatable, and runtime behaviour should be visible enough to diagnose.",
          "That is the direction of my current work with CI/CD, orchestration and observability tooling.",
        ],
      },
    ],
  },
};
