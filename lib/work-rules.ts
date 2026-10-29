import type { Work, WorkInput, WorkStatus } from './types';

/** Featured works must be published. Returns an error message or null. */
export function featuredRuleError(status: WorkStatus, featured: boolean): string | null {
  return featured && status !== 'published' ? '精选作品必须是已发布作品，请先将状态设为已发布，或取消精选。' : null;
}

/**
 * First-publish timestamp rule, shared by server actions and acceptance tests.
 * Set published_at on the first transition to published only; later edits
 * and republishing after archive must NOT reset it.
 */
export function applyPublishedAt(
  existing: Pick<Work, 'status' | 'published_at'> | null,
  input: { status: WorkStatus; published_at?: string | null },
  nowIso: string,
): string | null {
  if (input.status !== 'published') return existing?.published_at ?? input.published_at ?? null;
  if (existing?.published_at) return existing.published_at;
  if (existing && existing.status === 'published') return existing.published_at;
  return nowIso;
}

export function slugTaken(works: Array<{ id: string; slug: string }>, slug: string, excludeId?: string | null): boolean {
  return works.some((w) => w.slug === slug && w.id !== excludeId);
}

/**
 * Category delete safety (pure helper, tested by scripts/security-check).
 * works.category is a slug string, not a DB foreign key (see migration
 * 004's header note), so the app layer must block deleting a category
 * that works still reference — otherwise those works become orphans
 * whose category name can no longer resolve. Returns the referencing
 * works; deleteCategoryAction rejects when this is non-empty.
 */
export function worksReferencingCategory(
  works: Array<{ category: string; title: string }>,
  categorySlug: string,
): Array<{ category: string; title: string }> {
  return works.filter((w) => w.category === categorySlug);
}

/** URLs on a work that may point at a stored file. */
export function workFileUrls(work: Pick<Work, 'cover_image_url' | 'gallery_images' | 'og_image_url'>): string[] {
  return [work.cover_image_url, ...(work.gallery_images ?? []), work.og_image_url].filter(
    (u): u is string => Boolean(u),
  );
}

/**
 * Cleanup plan: a stored URL may only be deleted when no OTHER work
 * references it. Returns the URLs safe to delete and the ones to keep.
 * Pure function — the caller performs the actual deletion per mode.
 */
export function planCleanup(
  allWorks: Work[],
  targetId: string,
): { toDelete: string[]; kept: string[] } {
  const target = allWorks.find((w) => w.id === targetId);
  if (!target) return { toDelete: [], kept: [] };
  const others = allWorks.filter((w) => w.id !== targetId);
  const referencedElsewhere = new Set(others.flatMap((w) => workFileUrls(w)));
  const toDelete: string[] = [];
  const kept: string[] = [];
  for (const url of Array.from(new Set(workFileUrls(target)))) {
    if (referencedElsewhere.has(url)) kept.push(url);
    else toDelete.push(url);
  }
  return { toDelete, kept };
}

export function normalizeWorkInput(input: WorkInput): WorkInput {
  return {
    ...input,
    description: input.description ?? null,
    cover_image_url: input.cover_image_url || null,
    demo_url: input.demo_url || null,
    repo_url: input.repo_url || null,
    source_url: input.source_url || null,
    og_image_url: input.og_image_url || null,
    seo_title: input.seo_title || null,
    seo_description: input.seo_description || null,
    published_at: input.published_at ?? null,
    started_at: input.started_at || null,
    external_links: input.external_links ?? [],
    highlights: input.highlights ?? [],
    tags: input.tags ?? [],
    gallery_images: input.gallery_images ?? [],
  };
}
