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
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      ...base,
      title: z.string(),
      shortTitle: z.string().optional(),
      summary: z.string(),
      status: z.enum(["completed", "ongoing", "planned"]),
      startDate: date.nullable(),
      endDate: date.optional(),
      present: z.boolean().default(false),
      featured: z.boolean().default(false),
      featuredOrder: z.number().optional(),
      role: z.string(),
      cardRole: z.string().optional(),
      tags: z.array(z.string()),
      technologies: z.array(z.object({ name: z.string(), state })),
      cover: z.object({
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
        focalPoint: z
          .object({
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
          })
          .optional(),
      }),
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
    titleOriginal: z.string(),
    languageOriginal: locale,
    titleEnglish: z.string().optional(),
    englishSummary: z.string().optional(),
    authors: z.array(z.string()),
    year: z.number().int(),
    venue: z.string().nullable(),
    status: z.enum(["published", "accepted", "submitted", "unknown"]),
    featured: z.boolean().default(false),
    featuredOrder: z.number().optional(),
    doi: z.string().optional(),
    externalUrl: z.string().url().optional(),
    pdf: z.string().optional(),
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
