import { z } from 'zod';
import { isSafeHttpUrl, isSafeImageUrl } from './safe-url';

// NOTE: zod .url() accepts ANY scheme (javascript:, data:, vbscript:),
// so it is never used for user-supplied links/images here. http(s)-only
// for clickable links; http(s) or a same-site /path for image sources.
const httpUrl = (msg: string) =>
  z.string().max(1000).refine((v) => isSafeHttpUrl(v), { message: msg });
const imageUrl = (msg: string) =>
  z.string().max(1000).refine((v) => isSafeImageUrl(v), { message: msg });
const optionalHttpUrl = (msg: string) => httpUrl(msg).optional().nullable().or(z.literal(''));
const optionalImageUrl = (msg: string) => imageUrl(msg).optional().nullable().or(z.literal(''));
const externalLinkSchema = z.object({
  label: z.string().min(1, '链接名称不能为空').max(50),
  url: httpUrl('外部链接必须是 http(s) 链接'),
});

export const workSchema = z.object({
  slug: z.string().min(1, '别名不能为空').max(100).regex(/^[a-z0-9-]+$/, '别名只能用小写字母、数字和连字符'),
  title: z.string().min(1, '标题不能为空').max(100),
  summary: z.string().min(1, '简介不能为空').max(300),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().min(1, '请选择分类'),
  tags: z.array(z.string()).default([]),
  cover_image_url: optionalImageUrl('封面必须是 http(s) 链接或站内路径'),
  gallery_images: z.array(imageUrl('截图必须是 http(s) 链接或站内路径')).default([]),
  highlights: z.array(z.string()).default([]),
  demo_url: optionalHttpUrl('体验链接必须是 http(s) 链接'),
  repo_url: optionalHttpUrl('仓库链接必须是 http(s) 链接'),
  source_url: optionalHttpUrl('源代码链接必须是 http(s) 链接'),
  external_links: z.array(externalLinkSchema).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
  published_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  seo_title: z.string().max(100).optional().nullable(),
  seo_description: z.string().max(300).optional().nullable(),
  og_image_url: optionalImageUrl('OG 图片必须是 http(s) 链接或站内路径'),
});
export type WorkFormValues = z.infer<typeof workSchema>;
export const categorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, '别名只能用小写字母、数字和连字符'),
  description: z.string().max(300).optional().nullable(),
  sort_order: z.coerce.number().int().default(0)
});
export function parseTags(raw: string): string[] {
  return raw.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
}
export function fieldErrors(e: unknown): Record<string, string> {
  if (e && typeof e === 'object' && 'issues' in e && Array.isArray((e as { issues: unknown[] }).issues)) {
    const out: Record<string, string> = {};
    for (const issue of (e as { issues: Array<{ path: (string | number)[]; message: string }> }).issues) {
      const key = issue.path[0] ? String(issue.path[0]) : 'form';
      if (!out[key]) out[key] = issue.message;
    }
    return out;
  }
  return {};
}
export function slugifyTitle(title: string): string {
  // Slugs are ASCII-only (see workSchema); non-ASCII words are dropped,
  // so a Chinese title yields an empty suggestion the user can fill in.
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
