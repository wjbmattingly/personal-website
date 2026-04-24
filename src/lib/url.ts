const base = import.meta.env.BASE_URL;

/**
 * Prefix a path with the site's configured base (`astro.config.mjs#base`).
 * Pass site-absolute paths like `/about` or `/images/foo.jpg`. External URLs
 * and mailto/tel links are returned unchanged.
 */
export function url(path: string): string {
  if (!path) return base;
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${clean}`;
}
