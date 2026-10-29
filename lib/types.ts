export type WorkStatus = 'draft' | 'published' | 'archived';
export interface Category { id: string; name: string; slug: string; description?: string | null; sort_order?: number }
export interface ExternalLink { label: string; url: string }
export interface Work {
  id: string; slug: string; title: string; summary: string; description: string | null;
  category: string; tags: string[]; cover_image_url: string | null; gallery_images: string[];
  highlights: string[];
  demo_url: string | null; repo_url: string | null; source_url: string | null;
  external_links: ExternalLink[];
  status: WorkStatus; featured: boolean;
  sort_order: number;
  published_at: string | null; started_at: string | null;
  seo_title: string | null; seo_description: string | null; og_image_url: string | null;
  created_at: string; updated_at: string;
}
export type WorkInput = Omit<Work, 'id' | 'created_at' | 'updated_at'>;
export type RepoMode = 'demo' | 'supabase';
