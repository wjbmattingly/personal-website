/**
 * Site metadata and long-form copy that you edit in one place.
 * Theme colors live in `src/styles/theme.css`.
 */
export const site = {
  title: "William Mattingly, PhD",
  description:
    "Historian, data scientist, and NLP engineer working with cultural heritage and multilingual documents.",
  url: "https://www.wjbmattingly.com",
  author: "William Mattingly",
} as const;

export const contact = {
  bookConsult: {
    label: "Contact",
    href: "/contact",
  },
} as const;

export const social = [
  {
    name: "GitHub",
    href: "https://github.com/wjbmattingly",
  },
  {
    name: "X",
    href: "https://x.com/wjb_mattingly",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/wjbmattingly/",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/c/pythontutorialsfordigitalhumanities",
  },
  {
    name: "Hugging Face",
    href: "https://huggingface.co/wjbmattingly",
  },
] as const;

/** Newest (by end year in `years` string) first */
export const awards = [
  {
    title: "American Council of Learned Societies",
    body: "ACLS Digital Justice Development Grant for my work on Personal Writes the Political with Steve Davis.",
    years: "2024–2025",
  },
  {
    title: "American Council of Learned Societies",
    body: "ACLS Digital Justice Seed Grant for my work on Personal Writes the Political with Steve Davis.",
    years: "2023–2024",
  },
  {
    title: "Harry Frank Guggenheim",
    body: "Awarded for my work on the Bitter Aloe Project with Steve Davis.",
    years: "2021–2022",
  },
] as const;
