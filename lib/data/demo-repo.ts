import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Category, Work, WorkInput } from '../types';
import { seedCategories, seedWorks } from './seed';
import type { ListPublishedOpts, WorkRepository, WorkSort } from './repository';

const worksFile = () => path.join(process.cwd(), 'data', 'works.json');
const catsFile = () => path.join(process.cwd(), 'data', 'categories.json');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { const raw = await fs.readFile(file, 'utf-8'); return JSON.parse(raw) as T; }
  catch { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(fallback, null, 2)); return fallback; }
}
async function writeJson(file: string, data: unknown) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data, null, 2)); }

function normalize(w: Work): Work {
  return {
    ...w,
    highlights: w.highlights ?? [], tags: w.tags ?? [], gallery_images: w.gallery_images ?? [],
    source_url: w.source_url ?? null, external_links: w.external_links ?? [],
    published_at: w.published_at ?? null, started_at: w.started_at ?? null,
    seo_title: w.seo_title ?? null, seo_description: w.seo_description ?? null,
    og_image_url: w.og_image_url ?? null,
  };
}

function sortWorks(list: Work[], sort: WorkSort = 'manual'): Work[] {
  const arr = [...list];
  if (sort === 'latest') return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return arr.sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
}

function publishedOnly(w: Work[], opts?: ListPublishedOpts) {
  let list = w.filter((x) => x.status === 'published').map(normalize);
  if (opts?.category) { const cat = opts.category; list = list.filter((x) => x.category === cat); }
  if (opts?.tag) { const tag = opts.tag; list = list.filter((x) => x.tags.includes(tag)); }
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    list = list.filter((x) =>
      (x.title + ' ' + x.summary + ' ' + (x.description ?? '') + ' ' + x.tags.join(' ')).toLowerCase().includes(q),
    );
  }
  return sortWorks(list, opts?.sort);
}

export const demoRepo: WorkRepository = {
  mode: 'demo',
  async listPublished(opts) { return publishedOnly(await readJson<Work[]>(worksFile(), seedWorks), opts); },
  async listPublishedPaged(opts) {
    const all = publishedOnly(await readJson<Work[]>(worksFile(), seedWorks), opts);
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 9));
    return { works: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  },
  async listTags() {
    const w = await readJson<Work[]>(worksFile(), seedWorks);
    return Array.from(new Set(w.filter((x) => x.status === 'published').flatMap((x) => x.tags ?? []))).sort();
  },
  async listAll() { const w = await readJson<Work[]>(worksFile(), seedWorks); return sortWorks(w.map(normalize), 'manual'); },
  async getBySlug(slug) { const w = await readJson<Work[]>(worksFile(), seedWorks); const f = w.find((x) => x.slug === slug); return f ? normalize(f) : null; },
  async getById(id) { const w = await readJson<Work[]>(worksFile(), seedWorks); const f = w.find((x) => x.id === id); return f ? normalize(f) : null; },
  async create(input) {
    const w = await readJson<Work[]>(worksFile(), seedWorks);
    if (w.some((x) => x.slug === input.slug)) throw new Error('别名已存在，请换一个');
    const now = new Date().toISOString();
    const item: Work = { ...normalize({ ...input, id: '', created_at: '', updated_at: '' }), id: `work-${Date.now()}`, created_at: now, updated_at: now };
    w.push(item); await writeJson(worksFile(), w); return item;
  },
  async update(id, input) {
    const w = await readJson<Work[]>(worksFile(), seedWorks);
    const i = w.findIndex((x) => x.id === id); if (i < 0) throw new Error('作品不存在');
    if (input.slug && w.some((x) => x.slug === input.slug && x.id !== id)) throw new Error('别名已存在');
    w[i] = { ...w[i], ...input, updated_at: new Date().toISOString() }; await writeJson(worksFile(), w); return normalize(w[i]);
  },
  async remove(id) { const w = await readJson<Work[]>(worksFile(), seedWorks); await writeJson(worksFile(), w.filter((x) => x.id !== id)); },
  async listCategories() { return readJson<Category[]>(catsFile(), seedCategories); },
  async createCategory(c) { const list = await readJson<Category[]>(catsFile(), seedCategories); const item = { ...c, id: `cat-${Date.now()}` }; list.push(item); await writeJson(catsFile(), list); return item; },
  async removeCategory(id) { const list = await readJson<Category[]>(catsFile(), seedCategories); await writeJson(catsFile(), list.filter((x) => x.id !== id)); },
};
