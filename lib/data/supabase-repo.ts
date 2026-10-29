import type { Category, Work, WorkInput } from '../types';
import type { ListPublishedOpts, PagedResult, WorkRepository, WorkSort } from './repository';
import { createServerSupabase } from '../supabase/server';

function mapWork(r: Record<string, unknown>): Work {
  return {
    id: String(r.id), slug: String(r.slug), title: String(r.title), summary: String(r.summary),
    description: (r.description as string) ?? null, category: String(r.category),
    tags: (r.tags as string[]) ?? [], cover_image_url: (r.cover_image_url as string) ?? null,
    gallery_images: (r.gallery_images as string[]) ?? [],
    highlights: (r.highlights as string[]) ?? [],
    demo_url: (r.demo_url as string) ?? null,
    repo_url: (r.repo_url as string) ?? null,
    source_url: (r.source_url as string) ?? null,
    external_links: (r.external_links as Work['external_links']) ?? [],
    status: r.status as Work['status'], featured: Boolean(r.featured),
    sort_order: Number(r.sort_order ?? 0),
    published_at: (r.published_at as string) ?? null,
    started_at: (r.started_at as string) ?? null,
    seo_title: (r.seo_title as string) ?? null,
    seo_description: (r.seo_description as string) ?? null,
    og_image_url: (r.og_image_url as string) ?? null,
    created_at: String(r.created_at), updated_at: String(r.updated_at),
  };
}
function toRow(input: Partial<WorkInput>) {
  return {
    ...input,
    demo_url: input.demo_url || null, repo_url: input.repo_url || null,
    source_url: input.source_url || null, cover_image_url: input.cover_image_url || null,
    og_image_url: input.og_image_url || null, seo_title: input.seo_title || null,
    seo_description: input.seo_description || null, published_at: input.published_at ?? null,
    started_at: input.started_at || null, external_links: input.external_links ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySort(q: any, sort: WorkSort = 'manual') {
  return sort === 'latest' ? q.order('created_at', { ascending: false }) : q.order('sort_order').order('created_at', { ascending: false });
}

/** Escape a user keyword for a PostgREST ilike pattern (% _ \ are wildcards). */
function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function sortWorks(list: Work[], sort: WorkSort = 'manual'): Work[] {
  const arr = [...list];
  if (sort === 'latest') return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return arr.sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
}

/**
 * DB-side published filtering.
 *
 * The old code fetched EVERY published row and filtered tag/keyword in
 * memory — fine for 5 seed works, a full-table read at portfolio scale.
 * Now:
 * - tag: pushed to Postgres as array containment (tags @> ARRAY[tag]),
 *   served by the GIN index in migration 004;
 * - category: a plain eq() (index idx_works_status_category);
 * - keyword (q): pushed to Postgres as ilike on title / summary /
 *   description (three narrow queries, unioned by id), PLUS a
 *   tags-only query (id, tags) whose substring match reproduces the
 *   demo repo's "tags joined into the search text" semantics without
 *   fetching full rows. Full rows are then fetched only for matches
 *   via .in('id', ...). Total/count therefore stays exact, and the
 *   demo and Supabase repos return identical result sets for the
 *   same data (verified by scripts/security-check.mts).
 * No-q requests keep the old fast path (single query + range/count).
 */
async function fetchPublishedFiltered(
  opts: ListPublishedOpts & { page?: number; pageSize?: number; paged: boolean },
): Promise<PagedResult> {
  const sb = createServerSupabase();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 9));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyBase = (q: any): any => {
    let query = q;
    query = query.eq('status', 'published');
    if (opts.category) query = query.eq('category', opts.category);
    if (opts.tag) query = query.contains('tags', [opts.tag]);
    return query;
  };

  if (!opts.q) {
    if (opts.paged) {
      const ordered = applySort(applyBase(sb.from('works').select('*', { count: 'exact' })), opts.sort);
      const { data, error, count } = await ordered.range((page - 1) * pageSize, page * pageSize - 1);
      if (error) throw new Error(error.message);
      return { works: (data ?? []).map(mapWork), total: count ?? 0 };
    }
    const ordered = applySort(applyBase(sb.from('works').select('*')), opts.sort);
    const { data, error } = await ordered;
    if (error) throw new Error(error.message);
    return { works: (data ?? []).map(mapWork), total: (data ?? []).length };
  }

  // Keyword path: DB ilike on the three text columns + tag-substring.
  const pattern = `%${escapeIlike(opts.q)}%`;
  const textQueries = (['title', 'summary', 'description'] as const).map(async (col) => {
    const { data, error } = await applyBase(sb.from('works').select('id')).ilike(col, pattern);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ id: unknown }>).map((r) => String(r.id));
  });
  const tagQuery = (async () => {
    const { data, error } = await applyBase(sb.from('works').select('id,tags'));
    if (error) throw new Error(error.message);
    const needle = opts.q!.toLowerCase();
    return ((data ?? []) as Array<{ id: unknown; tags?: string[] }>)
      .filter((r) => (r.tags ?? []).some((t) => t.toLowerCase().includes(needle)))
      .map((r) => String(r.id));
  })();
  const idGroups = await Promise.all([...textQueries, tagQuery]);
  const ids = Array.from(new Set(idGroups.flat()));
  if (ids.length === 0) return { works: [], total: 0 };
  const { data, error } = await sb.from('works').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  const sorted = sortWorks((data ?? []).map(mapWork), opts.sort);
  if (!opts.paged) return { works: sorted, total: sorted.length };
  return { works: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length };
}

export const supabaseRepo: WorkRepository = {
  mode: 'supabase',
  async listPublished(opts) {
    const result = await fetchPublishedFiltered({ ...opts, paged: false });
    return result.works;
  },
  async listPublishedPaged(opts) {
    return fetchPublishedFiltered({ ...opts, paged: true });
  },
  async listTags() {
    const sb = createServerSupabase();
    const { data, error } = await sb.from('works').select('tags').eq('status', 'published');
    if (error) throw new Error(error.message);
    return Array.from(new Set((data ?? []).flatMap((r) => (r.tags as string[]) ?? []))).sort();
  },
  async listAll() { const sb = createServerSupabase(); const { data, error } = await sb.from('works').select('*').order('sort_order'); if (error) throw new Error(error.message); return (data ?? []).map(mapWork); },
  async getBySlug(slug) { const sb = createServerSupabase(); const { data, error } = await sb.from('works').select('*').eq('slug', slug).maybeSingle(); if (error) throw new Error(error.message); return data ? mapWork(data) : null; },
  async getById(id) { const sb = createServerSupabase(); const { data, error } = await sb.from('works').select('*').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data ? mapWork(data) : null; },
  async create(input) { const sb = createServerSupabase(); const { data, error } = await sb.from('works').insert(toRow(input)).select().single(); if (error) throw new Error(error.message); return mapWork(data); },
  async update(id, input) { const sb = createServerSupabase(); const { data, error } = await sb.from('works').update(toRow(input)).eq('id', id).select().single(); if (error) throw new Error(error.message); return mapWork(data); },
  async remove(id) { const sb = createServerSupabase(); const { error } = await sb.from('works').delete().eq('id', id); if (error) throw new Error(error.message); },
  async listCategories() { const sb = createServerSupabase(); const { data, error } = await sb.from('categories').select('*').order('sort_order'); if (error) throw new Error(error.message); return (data ?? []) as Category[]; },
  async createCategory(c) { const sb = createServerSupabase(); const { data, error } = await sb.from('categories').insert(c).select().single(); if (error) throw new Error(error.message); return data as Category; },
  async removeCategory(id) { const sb = createServerSupabase(); const { error } = await sb.from('categories').delete().eq('id', id); if (error) throw new Error(error.message); },
};
