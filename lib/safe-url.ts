/**
 * Safe-URL helpers — defence against javascript:/data:/vbscript: links.
 *
 * zod's .url() accepts ANY scheme, so validation alone is not enough:
 * a stored javascript: URL rendered as <a href> would execute on click,
 * and a data:text/html cover would render as an image source an attacker
 * controls. These helpers are used BOTH in zod validation (lib/validation.ts)
 * and at render time (detail page, CoverImage), so even a value that
 * bypassed validation (old row, direct DB write, demo JSON edit) is
 * never rendered as a live link or image.
 */

/** http(s) only. Used for links the user clicks: demo, source, repo, external. */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Image sources: http(s) URLs, or a same-site relative path such as
 * /uploads/abc.png or /covers/1.svg. Protocol-relative (//evil), absolute
 * URLs with another scheme, and data:/javascript: are rejected.
 */
export function isSafeImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return isSafeHttpUrl(value);
}

/** Return the URL only if it is a safe http(s) link, else null. */
export function safeHref(value: string | null | undefined): string | null {
  return isSafeHttpUrl(value) ? (value as string) : null;
}

/** Return the URL only if it is a safe image source, else null. */
export function safeImgSrc(value: string | null | undefined): string | null {
  return isSafeImageUrl(value) ? (value as string) : null;
}
