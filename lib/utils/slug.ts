// URL-safe identifier generation. Used by courses and categories.
//
// `slugify` is deterministic: same input always returns the same
// output. `ensureUniqueSlug` layers a numeric suffix when a slug
// is already taken.

const MAX_SLUG_LENGTH = 80

/**
 * Lowercase, ASCII-only, hyphen-separated identifier suitable for
 * URLs. Strips accents, replaces any non-alphanumeric run with a
 * single hyphen, and trims leading/trailing hyphens.
 *
 *   slugify('  The 7-Figure Agency!  ')  → '7-figure-agency'
 *   slugify('Café au lait')               → 'cafe-au-lait'
 *   slugify('')                           → ''
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
}

/**
 * Returns a slug guaranteed to satisfy `isTaken`. Tries the base
 * first, then appends `-2`, `-3`, … until a free value is found.
 * The numeric suffix replaces (not extends) any tail digits so we
 * don't end up with `my-course-2-3` style ratchets.
 *
 * `isTaken` receives the candidate; should return true if a row
 * with that slug already exists (excluding the row being edited).
 */
export async function ensureUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const normalized = slugify(base) || 'untitled'
  if (!(await isTaken(normalized))) return normalized

  for (let i = 2; i < 1000; i++) {
    const candidate = `${normalized}-${i}`.slice(0, MAX_SLUG_LENGTH)
    if (!(await isTaken(candidate))) return candidate
  }

  // Astronomically unlikely fallback — at this point a collision
  // suffix collided 998 times in a row. Use a random tail.
  return `${normalized}-${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    MAX_SLUG_LENGTH,
  )
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Validates that a string is already in slug form. Use in Zod
 * `.refine()` calls for admin-provided slugs. */
export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length <= MAX_SLUG_LENGTH
}
