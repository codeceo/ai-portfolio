'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getRepository, getMode } from './data/repository';
import { workSchema, categorySchema, fieldErrors, type WorkFormValues } from './validation';
import { DEMO_COOKIE, requireAdmin } from './auth';
import { applyPublishedAt, featuredRuleError, planCleanup, slugTaken, normalizeWorkInput, worksReferencingCategory } from './work-rules';
import { localUploadName, supabaseObjectPath, uniqueFileName, validateImageFile, validateUploadedImage } from './upload';
import type { Work, WorkInput, WorkStatus } from './types';
import fs from 'node:fs/promises';
import path from 'node:path';

function clean(v: FormDataEntryValue | null) { return typeof v === 'string' ? v.trim() : ''; }

/** Parse external_links from a JSON string field (form) or array (API). */
function parseExternalLinks(raw: unknown): Array<{ label: string; url: string }> {
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x.label === 'string' && typeof x.url === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x.label === 'string' && typeof x.url === 'string');
    } catch { /* fall through to [] */ }
  }
  return [];
}

function parseWorkForm(fd: FormData): WorkFormValues {
  const tags = clean(fd.get('tags')).split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
  const gallery = clean(fd.get('gallery_images')).split(/[\n,，]+/).map((t) => t.trim()).filter(Boolean);
  const highlights = clean(fd.get('highlights')).split(/[\n]+/).map((t) => t.trim()).filter(Boolean);
  return workSchema.parse({
    slug: clean(fd.get('slug')), title: clean(fd.get('title')), summary: clean(fd.get('summary')),
    description: clean(fd.get('description')) || null, category: clean(fd.get('category')), tags,
    cover_image_url: clean(fd.get('cover_image_url')) || null, gallery_images: gallery, highlights,
    demo_url: clean(fd.get('demo_url')) || null, repo_url: clean(fd.get('repo_url')) || null,
    source_url: clean(fd.get('source_url')) || null,
    external_links: parseExternalLinks(clean(fd.get('external_links'))),
    status: clean(fd.get('status')) || 'draft', featured: fd.get('featured') === 'on',
    sort_order: Number(clean(fd.get('sort_order')) || 0),
    started_at: clean(fd.get('started_at')) || null,
    seo_title: clean(fd.get('seo_title')) || null, seo_description: clean(fd.get('seo_description')) || null,
    og_image_url: clean(fd.get('og_image_url')) || null,
  });
}

/** Shared save path used by the FormData action and the controlled form. */
export async function saveWorkCore(
  values: WorkFormValues,
  id?: string | null,
): Promise<{ ok: boolean; message: string; errors?: Record<string, string>; workId?: string; slug?: string }> {
  await requireAdmin();
  const featuredError = featuredRuleError(values.status, values.featured);
  if (featuredError) return { ok: false, message: featuredError, errors: { featured: featuredError } };
  const repo = await getRepository();
  const all = await repo.listAll();
  if (slugTaken(all, values.slug, id ?? null)) {
    return { ok: false, message: '别名已被使用，请换一个', errors: { slug: '别名已被使用，请换一个' } };
  }
  // A work must reference a category that actually exists. Without this
  // check a typed-in category slug would silently orphan the work (its
  // category name could no longer resolve on public pages).
  const cats = await repo.listCategories();
  if (!cats.some((c) => c.slug === values.category)) {
    return { ok: false, message: '分类不存在，请先在分类管理中创建该分类', errors: { category: '分类不存在' } };
  }
  const existing = id ? (await repo.getById(id)) ?? null : null;
  if (id && !existing) return { ok: false, message: '作品不存在' };
  // published_at is SERVER-COMPUTED ONLY: a client-supplied value in the
  // form payload is never trusted (it could otherwise forge a first-
  // publish date on a draft). applyPublishedAt() sets it once, on the
  // first transition to published, and never resets it afterwards.
  const input = normalizeWorkInput({
    ...values,
    description: values.description ?? null,
    published_at: applyPublishedAt(existing, { status: values.status }, new Date().toISOString()),
  } as WorkInput);
  const saved = existing ? await repo.update(existing.id, input) : await repo.create(input);
  revalidateAll(saved.slug);
  return { ok: true, message: id ? '已保存修改' : '已创建作品', workId: saved.id, slug: saved.slug };
}

export async function saveWorkAction(_prev: { ok: boolean; message: string } | null, fd: FormData) {
  try {
    const values = parseWorkForm(fd);
    const id = clean(fd.get('id')) || null;
    const r = await saveWorkCore(values, id);
    return { ok: r.ok, message: r.message };
  } catch (e) {
    const errors = fieldErrors(e);
    if (Object.keys(errors).length > 0) {
      return { ok: false, message: Object.values(errors)[0] };
    }
    return { ok: false, message: e instanceof Error ? e.message : '保存失败' };
  }
}

/** Controlled-form save: returns field-level errors so the form keeps its content. */
export async function saveWorkFormAction(
  values: unknown,
  id?: string | null,
): Promise<{ ok: boolean; message: string; errors?: Record<string, string>; workId?: string; slug?: string }> {
  try {
    const parsed = workSchema.parse(values);
    return await saveWorkCore(parsed, id ?? null);
  } catch (e) {
    const errors = fieldErrors(e);
    if (Object.keys(errors).length > 0) {
      return { ok: false, message: '请检查表单错误', errors };
    }
    return { ok: false, message: e instanceof Error ? e.message : '保存失败' };
  }
}

export async function checkSlugAction(
  slug: string,
  excludeId?: string | null,
): Promise<{ available: boolean; message: string }> {
  await requireAdmin();
  if (!slug) return { available: false, message: '请先填写别名' };
  if (!/^[a-z0-9-]+$/.test(slug)) return { available: false, message: '别名只能用小写字母、数字和连字符' };
  const repo = await getRepository();
  const all = await repo.listAll();
  if (slugTaken(all, slug, excludeId ?? null)) return { available: false, message: '别名已被使用，请换一个' };
  return { available: true, message: '别名可用' };
}

function revalidateAll(slug?: string) {
  revalidatePath('/'); revalidatePath('/works'); revalidatePath('/sitemap.xml'); revalidatePath('/admin'); revalidatePath('/admin/works');
  if (slug) revalidatePath(`/works/${slug}`);
}

async function applyStatus(id: string, status: WorkStatus): Promise<Work> {
  const repo = await getRepository();
  const work = await repo.getById(id);
  if (!work) throw new Error('作品不存在');
  // Archiving a featured work clears its featured flag in the same update
  // (a featured work must be published); this is not a silent save-rule
  // bypass — the featured toggle itself still rejects featured+archived.
  const patch: Partial<Parameters<typeof repo.update>[1]> = { status };
  if (status !== 'published' && work.featured) (patch as Record<string, unknown>).featured = false;
  if (status === 'published') {
    (patch as Record<string, unknown>).published_at = applyPublishedAt(work, { status }, new Date().toISOString());
  }
  const saved = await repo.update(id, patch);
  revalidateAll(saved.slug);
  return saved;
}

export async function setStatusAction(id: string, status: WorkStatus) {
  await requireAdmin();
  await applyStatus(id, status);
}

export async function toggleFeaturedAction(id: string, featured: boolean) {
  await requireAdmin();
  const repo = await getRepository();
  const work = await repo.getById(id);
  if (!work) throw new Error('作品不存在');
  const err = featuredRuleError(work.status, featured);
  if (err) throw new Error(err);
  await repo.update(id, { featured });
  revalidateAll(work.slug);
}

export async function setSortAction(id: string, sort_order: number) {
  await requireAdmin();
  const repo = await getRepository();
  const work = await repo.getById(id);
  if (!work) throw new Error('作品不存在');
  await repo.update(id, { sort_order });
  revalidateAll(work.slug);
}

export interface BatchResult {
  succeeded: string[];
  failed: Array<{ title: string; reason: string }>;
}

export async function batchStatusAction(ids: string[], status: WorkStatus): Promise<BatchResult> {
  await requireAdmin();
  const repo = await getRepository();
  const out: BatchResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      const work = await repo.getById(id);
      if (!work) throw new Error('作品不存在');
      await applyStatus(id, status);
      out.succeeded.push(work.title);
    } catch (e) {
      const title = (await repo.getById(id))?.title ?? id;
      out.failed.push({ title, reason: e instanceof Error ? e.message : '操作失败' });
    }
  }
  return out;
}

/** Delete one work's stored files that no other work references. Best-effort. */
async function cleanupWorkFiles(work: Work, allWorks: Work[]): Promise<{ removed: string[]; kept: string[]; failed: string[] }> {
  const { toDelete, kept } = planCleanup(allWorks, work.id);
  const removed: string[] = [];
  const failed: string[] = [];
  for (const url of toDelete) {
    try {
      if (getMode() === 'supabase') {
        const objectPath = supabaseObjectPath(url);
        // External / non-storage URLs are not ours to delete: skip them
        // instead of reporting them as "removed" (the old code did that).
        if (!objectPath) continue;
        const { createServerSupabase } = await import('./supabase/server');
        const sb = createServerSupabase();
        const { error } = await sb.storage.from('portfolio-images').remove([objectPath]);
        if (error) throw new Error(error.message);
        removed.push(url);
      } else {
        const name = localUploadName(url);
        if (!name) continue; // external URL (e.g. /covers/*.svg seed) — not a stored upload
        const file = path.join(process.cwd(), 'public', 'uploads', name);
        await fs.unlink(file).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== 'ENOENT') throw err;
        });
        removed.push(url);
      }
    } catch (e) {
      failed.push(`${url}: ${e instanceof Error ? e.message : '删除失败'}`);
    }
  }
  return { removed, kept, failed };
}

export async function deleteWorkAction(id: string): Promise<{
  ok: boolean; message: string;
  cleanup?: { removed: string[]; kept: string[]; failed: string[] };
}> {
  await requireAdmin();
  const repo = await getRepository();
  const work = await repo.getById(id);
  if (!work) return { ok: false, message: '作品不存在' };
  const all = await repo.listAll();
  const cleanup = await cleanupWorkFiles(work, all);
  await repo.remove(id);
  revalidateAll(work.slug);
  const note = cleanup.failed.length > 0
    ? `（部分关联文件清理失败：${cleanup.failed.join('；')}，记录已删除）`
    : '';
  return { ok: true, message: `已删除「${work.title}」${note}`, cleanup };
}

export async function batchDeleteAction(ids: string[]): Promise<BatchResult & { cleanupFailed: string[] }> {
  await requireAdmin();
  const repo = await getRepository();
  const titles = new Map((await repo.listAll()).map((w) => [w.id, w.title]));
  const out: BatchResult & { cleanupFailed: string[] } = { succeeded: [], failed: [], cleanupFailed: [] };
  for (const id of ids) {
    const title = titles.get(id) ?? id;
    try {
      const r = await deleteWorkAction(id);
      if (!r.ok) throw new Error(r.message);
      out.succeeded.push(title);
      if (r.cleanup?.failed.length) out.cleanupFailed.push(...r.cleanup.failed);
    } catch (e) {
      out.failed.push({ title, reason: e instanceof Error ? e.message : '删除失败' });
    }
  }
  return out;
}

export async function createCategoryAction(_prev: { ok: boolean; message: string } | null, fd: FormData) {
  try {
    await requireAdmin();
    const parsed = categorySchema.parse({ name: clean(fd.get('name')), slug: clean(fd.get('slug')), description: clean(fd.get('description')) || null, sort_order: Number(clean(fd.get('sort_order')) || 0) });
    const repo = await getRepository();
    const existing = await repo.listCategories();
    if (existing.some((c) => c.slug === parsed.slug)) {
      return { ok: false, message: '分类别名已被使用，请换一个' };
    }
    await repo.createCategory(parsed);
    revalidatePath('/admin/categories'); revalidatePath('/works'); revalidatePath('/'); revalidatePath('/sitemap.xml');
    return { ok: true, message: '分类已创建' };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : '创建失败' }; }
}
export async function deleteCategoryAction(id: string) {
  await requireAdmin();
  const repo = await getRepository();
  const cats = await repo.listCategories();
  const cat = cats.find((c) => c.id === id);
  if (!cat) throw new Error('分类不存在');
  // BLOCK, don't orphan: deleting a referenced category would leave its
  // works with a category slug that no longer resolves. The admin must
  // reassign those works first. (There is deliberately no DB foreign key
  // for this — see migration 004's header note on legacy orphans.)
  const referencing = worksReferencingCategory(await repo.listAll(), cat.slug);
  if (referencing.length > 0) {
    const titles = referencing.slice(0, 3).map((w) => `「${w.title}」`).join('、');
    const more = referencing.length > 3 ? `等共 ${referencing.length} 件作品` : '';
    throw new Error(`该分类仍被 ${titles}${more} 引用，删除前请先为这些作品更换分类。`);
  }
  await repo.removeCategory(id);
  revalidatePath('/admin/categories'); revalidatePath('/works'); revalidatePath('/'); revalidatePath('/sitemap.xml');
}
export async function demoLoginAction(_prev: { ok: boolean; message: string } | null, fd: FormData) {
  const email = clean(fd.get('email')); const password = clean(fd.get('password'));
  if (getMode() !== 'demo') return { ok: false, message: '当前为 Supabase 模式，请使用 Supabase 登录' };
  if (email === 'admin@demo.local' && password === 'demo1234') {
    cookies().set(DEMO_COOKIE, '1', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/admin');
  }
  return { ok: false, message: '演示账号或密码错误（见 README 的本地演示说明）' };
}
export async function logoutAction() {
  cookies().delete(DEMO_COOKIE);
  if (getMode() === 'supabase') { try { const { createServerSupabase } = await import('./supabase/server'); await createServerSupabase().auth.signOut(); } catch { /* ignore */ } }
  redirect('/admin/login');
}
export async function uploadImageAction(fd: FormData): Promise<{ ok: boolean; url?: string; message?: string }> {
  try {
    await requireAdmin();
    const file = fd.get('file') as File | null;
    if (!file || file.size === 0) return { ok: false, message: '请选择图片文件' };
    const metaErr = validateImageFile({ type: file.type, size: file.size, name: file.name });
    if (metaErr) return { ok: false, message: metaErr };
    // Sniff the real bytes BEFORE writing anything, and use the validated
    // MIME for the Storage contentType — never the client-claimed type.
    const buf = Buffer.from(await file.arrayBuffer());
    const checked = validateUploadedImage({ type: file.type, size: file.size, name: file.name, bytes: new Uint8Array(buf) });
    if (!checked.ok) return { ok: false, message: checked.message };
    if (getMode() === 'supabase') {
      const { createServerSupabase } = await import('./supabase/server');
      const sb = createServerSupabase();
      const name = uniqueFileName(file.name);
      const { error } = await sb.storage.from('portfolio-images').upload(
        name, new File([buf], name, { type: checked.mime }), { upsert: false, contentType: checked.mime },
      );
      if (error) return { ok: false, message: error.message };
      const { data } = sb.storage.from('portfolio-images').getPublicUrl(name);
      return { ok: true, url: data.publicUrl };
    }
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(dir, { recursive: true });
    const name = uniqueFileName(file.name);
    await fs.writeFile(path.join(dir, name), buf);
    return { ok: true, url: `/uploads/${name}` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : '上传失败' }; }
}
