# personal-website

Static site for [wjbmattingly.com](https://www.wjbmattingly.com), built with [Astro](https://astro.build/) and deployed to **GitHub Pages** with **GitHub Actions** on every push to `main`.

## Local development

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Node 20+ (22+ recommended) matches `package.json` engines.

## Where to edit content

| What | Where |
|------|--------|
| Global title, social links, awards (newest first) on the home page | `src/config/site.ts` |
| **Theme (colors, type feel)** | `src/styles/theme.css` — all tokens are CSS variables. A second palette (`[data-theme="dusk"]`) is included; to try it, add `data-theme="dusk"` to the `<html>` tag in `src/components/SiteLayout.astro`. |
| **Talks** (by year folders) | `src/content/talks/<YEAR>/your-slug.mdx` — URL is `/talks/<YEAR>/your-slug`. Use folders from **2024** through the **current year** (see `src/content/talks/`). The talks index uses a **year sidebar** (`?year=2024`, default = current calendar year). **Upcoming** talks (date not yet passed) are listed at the top in the browser; after the last day of the event, they move to the year list on the next visit. |
| Talk year list in the sidebar | `src/config/talk-years.ts` — sidebar shows **2024 … current year** only (no future years). |
| Projects | `src/content/projects/*.mdx` — optional `image` in frontmatter (`/images/projects/...`) |
| Software | `src/content/software/*.mdx` — optional `image` in frontmatter (`/images/software/...`) |
| Long CV | `src/content/pages/curriculum-vitae.mdx` (rendered at `/curriculum-vitae`) |
| Home / About / Contact copy in components | `src/pages/index.astro`, `src/pages/about.astro`, `src/pages/contact.astro` |

### Talks: video and slides in Markdown / MDX

- **YouTube (or any iframe host):** in the `.mdx` file, paste a responsive block (classes are in `src/styles/global.css`):

  ```mdx
  <div class="embed-video" aria-label="Video">
    <iframe
      title="Talk recording"
      src="https://www.youtube.com/embed/VIDEO_ID"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    />
  </div>
  ```

- **PowerPoint / PDF:** put files under `public/slides/` (e.g. `public/slides/ai-at-yale.pptx`) and link from the talk:

  ```mdx
  [Download slides (PowerPoint)](/slides/ai-at-yale.pptx)
  ```

  For an Office Online embed, add the `iframe` Microsoft gives you in the same MDX file ( inside a `<div class="embed-video">` if the aspect ratio matches, or a plain `figure` ).

- **New talk:** add `src/content/talks/<YEAR>/<slug>.mdx` (copy an existing talk). Use the event’s calendar year as the folder name.

## Images

Hero and portrait images are in `public/images/`. Favicon is `public/favicon.ico`. **Software and project** thumbnails from the old site live under `public/images/software/` and `public/images/projects/` and are referenced from each item’s `image` field in the corresponding `.mdx` file.

## GitHub Pages and custom domain

1. Repository **Settings → Pages → Build and deployment:** source **GitHub Actions**.
2. The workflow in `.github/workflows/deploy.yml` builds with `npm ci` and `npm run build` and publishes the `dist` folder.
3. **Settings → Pages → Custom domain:** add `www.wjbmattingly.com` and/or the apex domain; enable **Enforce HTTPS** after DNS propagates.
4. `public/CNAME` is set to `www.wjbmattingly.com` so GitHub keeps that hostname. If you use only the apex domain, change `public/CNAME` to `wjbmattingly.com` and update DNS (see [GitHub docs for apex domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)).

5. In **Settings → Environments → github-pages** no secrets are required for the default `GITHUB_TOKEN` deploy.

`astro.config.mjs` sets `site: "https://www.wjbmattingly.com"` for canonical URLs; adjust if your live URL differs.

## What was brought over from the old site

Main professional pages: home (tagline, work-with sections, awards), talks with event metadata, software list, projects, about, contact, and curriculum vitae. **Images:** `wjb-mattingly.jpg`, `hero-travel.jpg`, and the favicon. The sitemap also listed Squarespace “Services,” “work-with-me” wellness boilerplate, and a recipe **blog**; those were not part of your public nav-focused professional site, so they are not copied here. You can add a `src/pages/blog/` section later if you want that content in this repo.
