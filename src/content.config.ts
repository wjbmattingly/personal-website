import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const talks = defineCollection({
  loader: glob({ base: "./src/content/talks", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    timeLabel: z.string().optional(),
    location: z.string().optional(),
    mapUrl: z.string().url().optional(),
    gcalUrl: z.string().url().optional(),
    icsUrl: z.string().url().optional(),
    order: z.number().optional().default(0),
    description: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    order: z.number().optional().default(0),
    link: z.string().url().optional(),
    tagline: z.string().optional(),
    /** Path under /public, e.g. /images/projects/foo.jpg */
    image: z.string().optional(),
  }),
});

const software = defineCollection({
  loader: glob({ base: "./src/content/software", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    order: z.number().optional().default(0),
    pypi: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    image: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { talks, projects, software, pages };
