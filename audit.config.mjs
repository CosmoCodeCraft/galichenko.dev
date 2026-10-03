// Only screenshot policy belongs here. Every generated HTML page is archived.
const topLevel = [
  "/",
  "/projects/",
  "/research/",
  "/notes/",
  "/about/",
  "/cv/",
];
const projects = [
  "/projects/sird/",
  "/projects/city-farm/",
  "/projects/vision/",
  "/projects/galichenko-dev/",
];
export default {
  themeStorageKey: "sg-theme",
  // Dates are read from emitted HTML, never inferred from titles or filenames.
  // Publication: declared year in the metadata line. Notes: first header time.
  // Ties use ascending route order. Latest and earliest collapse if only one exists.
  representatives: {
    publication: {
      selector: "article.publication-detail",
      dateSelector: ".publication-detail-meta",
      datePattern: "\\b(\\d{4})\\s*$",
      choices: ["latest"],
    },
    note: {
      selector: "article.note-detail",
      dateSelector: "header time[datetime]",
      dateAttribute: "datetime",
      choices: ["latest", "earliest"],
    },
  },
  categories: {
    project: "article.project-detail",
    publication: "article.publication-detail",
    note: "article.note-detail",
  },
  captures: [
    {
      name: "desktop-light",
      viewport: { width: 1440, height: 900 },
      theme: "light",
      fullPage: true,
      routes: [...topLevel, ...projects],
      representatives: ["publication:latest", "note:latest", "note:earliest"],
    },
    {
      name: "desktop-dark",
      viewport: { width: 1440, height: 900 },
      theme: "dark",
      fullPage: true,
      routes: [
        "/",
        "/projects/",
        "/about/",
        "/projects/sird/",
        "/projects/vision/",
      ],
    },
    {
      name: "mobile-light",
      viewport: { width: 390, height: 844 },
      theme: "light",
      fullPage: true,
      routes: [...topLevel, "/projects/sird/", "/projects/vision/"],
      representatives: ["note:latest"],
    },
    {
      name: "desktop-viewport",
      viewport: { width: 1440, height: 900 },
      theme: "light",
      fullPage: false,
      routes: ["/", "/projects/", "/research/", "/about/", "/cv/"],
    },
    {
      name: "mobile-viewport",
      viewport: { width: 390, height: 844 },
      theme: "light",
      fullPage: false,
      routes: ["/", "/projects/", "/about/"],
    },
  ],
};
