export const site = {
  name: "Sergey Galichenko",
  url: "https://sergeygalichenko.dev",
  email: "sagalichenko@edu.hse.ru",
  github: "https://github.com/CosmoCodeCraft",
  person: {
    givenName: "Sergey",
    familyName: "Galichenko",
    additionalName: "Alexandrovich",
    alternateName: [
      "Sergey Alexandrovich Galichenko",
      "Галиченко Сергей Александрович",
    ],
    description:
      "MSc student in System and Software Engineering at HSE University; alumnus of Moscow Polytechnic University.",
    affiliation: { "@type": "CollegeOrUniversity", name: "HSE University" },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Moscow Polytechnic University",
    },
  },
} as const;
export const navigation = [
  "projects",
  "research",
  "notes",
  "about",
  "cv",
] as const;
