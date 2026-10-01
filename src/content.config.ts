import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
const locale = z.enum(["en", "ru"]);
const base = {
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  locale,
  translationKey: z.string(),
  draft: z.boolean().default(false),
};
const date = z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/);
const link = z.object({ label: z.string(), url: z.string().url() });
const state = z.enum(["planned", "implemented", "verified"]);
const focalPoint = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  })
  .optional();
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      ...base,
      title: z.string(),
      shortTitle: z.string().optional(),
      summary: z.string(),
      detailSummary: z.string().optional(),
      detailStatus: z.string().optional(),
      detailRole: z.string().optional(),
      roleDetails: z.string().optional(),
      detailStack: z.array(z.string()).optional(),
      outcome: z.string().optional(),
      outcomeLabel: z.enum(["outcome", "currentState"]).optional(),
      status: z.enum(["completed", "ongoing", "planned"]),
      startDate: date.nullable(),
      endDate: date.optional(),
      present: z.boolean().default(false),
      featured: z.boolean().default(false),
      featuredOrder: z.number().optional(),
      archiveOrder: z.number().optional(),
      role: z.string(),
      cardRole: z.string().optional(),
      tags: z.array(z.string()),
      technologies: z.array(z.object({ name: z.string(), state })),
      cover: z
        .object({
          src: image(),
          alt: z.string(),
          caption: z.string().optional(),
          role: z
            .enum([
              "cover",
              "hero",
              "content",
              "diagram",
              "result",
              "hardware",
              "gallery",
            ])
            .default("cover"),
          cropAllowed: z.boolean().default(false),
          focalPoint,
        })
        .optional(),
      coverPlaceholder: z.string().optional(),
      detailHero: z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("image"),
            src: image(),
            alt: z.string().min(1),
            caption: z.string().optional(),
            cropAllowed: z.boolean().default(false),
            focalPoint,
          }),
          z.object({
            type: z.literal("video"),
            src: z.string().startsWith("/media/"),
            poster: image(),
            alt: z.string().min(1),
            caption: z.string().optional(),
          }),
          z.object({
            type: z.literal("placeholder"),
            placeholder: z.string().min(1),
            alt: z.literal("").default(""),
          }),
        ])
        .optional(),
      links: z.array(link).optional(),
      evidence: z
        .array(
          z.object({
            label: z.string(),
            state,
            url: z.string().url().optional(),
          }),
        )
        .optional(),
      relatedPublications: z.array(z.string()).optional(),
      relatedProjects: z.array(z.string()).optional(),
      toc: z
        .array(
          z.object({
            label: z.string(),
            id: z.string().regex(/^[a-z0-9-]+$/),
          }),
        )
        .optional(),
      updatedAt: date.optional(),
    }),
});
const publications = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/publications",
  }),
  schema: z.object({
    ...base,
    publicationType: z.enum([
      "conference-paper",
      "conference-abstract",
      "journal-article",
    ]),
    titleOriginal: z.string(),
    languageOriginal: locale,
    titleEnglish: z.string().optional(),
    authorsOriginal: z.array(
      z.object({ family: z.string(), given: z.string().optional() }),
    ),
    authorsEnglish: z
      .array(z.object({ family: z.string(), given: z.string().optional() }))
      .optional(),
    year: z.number().int(),
    sourceTitle: z.string().optional(),
    sourceTitleEnglish: z.string().optional(),
    publicationPlace: z.string().optional(),
    publisher: z.string().optional(),
    pages: z.string().optional(),
    issue: z.string().optional(),
    issn: z.string().optional(),
    conferenceTitle: z.string().optional(),
    conferenceUrl: z.string().url().optional(),
    conferenceDate: date.optional(),
    conferenceEndDate: date.optional(),
    affiliation: z.string().optional(),
    abstractOriginal: z.string().optional(),
    abstractEnglish: z.string().optional(),
    keywordsOriginal: z.array(z.string()).default([]),
    keywordsEnglish: z.array(z.string()).default([]),
    elibraryId: z.string().regex(/^\d+$/).optional(),
    edn: z
      .string()
      .regex(/^[A-Z]+$/)
      .optional(),
    rincIndexed: z.boolean().optional(),
    status: z.enum(["published", "accepted", "submitted", "unknown"]),
    featured: z.boolean().default(false),
    featuredOrder: z.number().optional(),
    doi: z.string().optional(),
    localPdf: z.string().startsWith("/publications/pdfs/").optional(),
    pdfKind: z.enum(["publication-extract"]).optional(),
    externalFullTextUrl: z.string().url().optional(),
    publisherUrl: z.string().url().optional(),
    elibraryUrl: z.string().url().optional(),
    ednUrl: z.string().url().optional(),
    relatedProject: z.string().optional(),
  }),
});
const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: ({ image }) =>
    z.object({
      ...base,
      title: z.string(),
      summary: z.string(),
      date,
      updatedAt: date.optional(),
      tags: z.array(z.string()),
      cover: z
        .object({
          src: image(),
          alt: z.string(),
          caption: z.string().optional(),
          role: z.string().optional(),
          cropAllowed: z.boolean().default(false),
          focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
        })
        .optional(),
      featured: z.boolean().default(false),
    }),
});
export const collections = { projects, publications, notes };
