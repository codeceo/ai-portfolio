import type { Category, Work, WorkInput } from '../types';
import { isSupabaseConfigured } from '../utils';

export type WorkSort = 'latest' | 'manual';
export interface ListPublishedOpts {
  category?: string;
  tag?: string;
  q?: string;
  sort?: WorkSort;
}
export interface PagedResult {
  works: Work[];
  total: number;
}

export interface WorkRepository {
  mode: 'demo' | 'supabase';
  listPublished(opts?: ListPublishedOpts): Promise<Work[]>;
  listPublishedPaged(
    opts: ListPublishedOpts & { page?: number; pageSize?: number },
  ): Promise<PagedResult>;
  listTags(): Promise<string[]>;
  listAll(): Promise<Work[]>;
  getBySlug(slug: string): Promise<Work | null>;
  getById(id: string): Promise<Work | null>;
  create(input: WorkInput): Promise<Work>;
  update(id: string, input: Partial<WorkInput>): Promise<Work>;
  remove(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;
  createCategory(c: Omit<Category, 'id'>): Promise<Category>;
  removeCategory(id: string): Promise<void>;
}
export async function getRepository(): Promise<WorkRepository> {
  if (isSupabaseConfigured()) {
    const m = await import('./supabase-repo');
    return m.supabaseRepo;
  }
  const m = await import('./demo-repo');
  return m.demoRepo;
}
export function getMode(): 'demo' | 'supabase' { return isSupabaseConfigured() ? 'supabase' : 'demo'; }
