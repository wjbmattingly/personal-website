# Blog content

Drop a Markdown (`.md`) or MDX (`.mdx`) file into this folder and it will
automatically appear in `/blog` (newest first by `pubDate`) and at
`/blog/<file-name-without-extension>`.

You can also organise posts into subfolders (e.g. `2026/my-post.md`); the
slug becomes `2026/my-post` and the URL becomes `/blog/2026/my-post`.

## Frontmatter

```yaml
---
title: "My new post"            # required
pubDate: 2026-04-25              # required (YYYY-MM-DD)
description: "A short summary."  # optional, shown on the index + meta tags
updatedDate: 2026-05-01          # optional
author: "William Mattingly"      # optional, defaults to nothing
tags: ["nlp", "history"]         # optional
image: "/images/blog/hero.jpg"   # optional, path under /public
imageAlt: "Description of image" # optional
draft: false                     # optional, true = hidden in production
---
```

The body is just standard Markdown. Headings, lists, code fences, links,
images, and blockquotes are all styled automatically by the global `.prose`
styles.

## Examples

See `hello-world.md` and `working-with-markdown.md` in this folder for two
complete examples you can copy.
