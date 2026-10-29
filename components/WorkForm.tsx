'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Category, Work } from '@/lib/types';
import { checkSlugAction, saveWorkFormAction } from '@/lib/admin-actions';
import { fieldErrors, slugifyTitle, workSchema } from '@/lib/validation';
import CoverImage from './CoverImage';

type FormState = {
  title: string; slug: string; summary: string; description: string; category: string;
  tagsStr: string; cover: string; gallery: string[]; highlightsStr: string;
  demo_url: string; repo_url: string; source_url: string;
  external_links: Array<{ label: string; url: string }>;
  status: 'draft' | 'published' | 'archived'; featured: boolean; sort_order: string;
  started_at: string; seo_title: string; seo_description: string; og_image_url: string;
};

function initialState(work: Work | null | undefined, categories: Category[]): FormState {
  return {
    title: work?.title ?? '',
    slug: work?.slug ?? '',
    summary: work?.summary ?? '',
    description: work?.description ?? '',
    category: work?.category ?? categories[0]?.slug ?? '',
    tagsStr: (work?.tags ?? []).join('，'),
    cover: work?.cover_image_url ?? '',
    gallery: work?.gallery_images ?? [],
    highlightsStr: (work?.highlights ?? []).join('\n'),
    demo_url: work?.demo_url ?? '',
    repo_url: work?.repo_url ?? '',
    source_url: work?.source_url ?? '',
    external_links: work?.external_links ?? [],
    status: work?.status ?? 'draft',
    featured: work?.featured ?? false,
    sort_order: String(work?.sort_order ?? 0),
    started_at: work?.started_at ?? '',
    seo_title: work?.seo_title ?? '',
    seo_description: work?.seo_description ?? '',
    og_image_url: work?.og_image_url ?? '',
  };
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { ok: boolean; url?: string; message?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.url) resolve(data.url);
        else reject(new Error(data.message ?? `上传失败（HTTP ${xhr.status}）`));
      } catch {
        reject(new Error(`上传失败（HTTP ${xhr.status}）`));
      }
    };
    xhr.onerror = () => reject(new Error('网络错误，上传失败'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

const fieldCls = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-lavender';
const labelCls = 'block text-sm';
const sectionCls = 'space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6';
const errCls = 'mt-1 text-xs text-red-300';

export default function WorkForm({ work, categories }: { work?: Work | null; categories: Category[] }) {
  const initial = useMemo(() => initialState(work ?? null, categories), [work, categories]);
  const [form, setForm] = useState<FormState>(initial);
  const [initialJson, setInitialJson] = useState(() => JSON.stringify(initial));
  const [slugTouched, setSlugTouched] = useState(Boolean(work?.slug));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [slugCheck, setSlugCheck] = useState('');
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [galleryProgress, setGalleryProgress] = useState<string>('');
  const [ogProgress, setOgProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(work?.id ?? null);
  const [savedSlug, setSavedSlug] = useState<string | null>(work?.slug ?? null);

  const dirty = JSON.stringify(form) !== initialJson;
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const onTitle = (title: string) => {
    setForm((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : (slugifyTitle(title) || prev.slug) }));
  };

  const buildValues = (statusOverride?: FormState['status']) => ({
    slug: form.slug.trim(),
    title: form.title.trim(),
    summary: form.summary.trim(),
    description: form.description.trim() || null,
    category: form.category,
    tags: form.tagsStr.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean),
    cover_image_url: form.cover.trim() || null,
    gallery_images: form.gallery,
    highlights: form.highlightsStr.split(/\n+/).map((t) => t.trim()).filter(Boolean),
    demo_url: form.demo_url.trim() || null,
    repo_url: form.repo_url.trim() || null,
    source_url: form.source_url.trim() || null,
    external_links: form.external_links.filter((l) => l.label.trim() || l.url.trim()),
    status: statusOverride ?? form.status,
    featured: form.featured,
    sort_order: Number(form.sort_order || 0),
    started_at: form.started_at || null,
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
    og_image_url: form.og_image_url.trim() || null,
  });

  const submit = async (statusOverride?: FormState['status']) => {
    setMessage(''); setSlugCheck('');
    const values = buildValues(statusOverride);
    const parsed = workSchema.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      setMessage('请检查表单错误，内容已保留在表单中。');
      const firstKey = Object.keys(errs)[0];
      if (firstKey) document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const r = await saveWorkFormAction(parsed.data, work?.id ?? savedId ?? null);
      if (!r.ok) {
        setErrors(r.errors ?? {});
        setMessage(r.message);
        return; // content stays in the controlled form
      }
      setMessage(r.message);
      setForm((prev) => ({ ...prev, status: statusOverride ?? prev.status }));
      setInitialJson(JSON.stringify({ ...form, status: statusOverride ?? form.status }));
      if (r.workId) setSavedId(r.workId);
      if (r.slug) setSavedSlug(r.slug);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败，内容已保留在表单中。');
    } finally { setSaving(false); }
  };

  const onCancel = (e: React.MouseEvent) => {
    if (dirty && !confirm('有未保存的更改，确定离开吗？')) e.preventDefault();
  };

  const uploadCover = async (file: File) => {
    setUploadError(''); setCoverProgress(0);
    try { set('cover', await uploadWithProgress(file, setCoverProgress)); }
    catch (e) { setUploadError(e instanceof Error ? e.message : '上传失败'); }
    finally { setCoverProgress(null); }
  };
  const uploadGallery = async (files: FileList | null) => {
    if (!files) return;
    setUploadError('');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setGalleryProgress(`正在上传 ${i + 1}/${files.length}：${file.name}`);
        const url = await uploadWithProgress(file, () => {});
        setForm((prev) => ({ ...prev, gallery: [...prev.gallery, url] }));
      } catch (e) { setUploadError(e instanceof Error ? e.message : '上传失败'); break; }
    }
    setGalleryProgress('');
  };
  const uploadOg = async (file: File) => {
    setUploadError(''); setOgProgress(0);
    try { set('og_image_url', await uploadWithProgress(file, setOgProgress)); }
    catch (e) { setUploadError(e instanceof Error ? e.message : '上传失败'); }
    finally { setOgProgress(null); }
  };

  const fieldErr = (name: string) => errors[name] ? <p className={errCls}>{errors[name]}</p> : null;

  return (
    <div className="space-y-6">
      {dirty && <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">● 有未保存的更改</p>}
      {message && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">{message}</p>}
      {savedId && savedSlug && message.startsWith('已') && (
        <p className="text-sm text-muted2">
          <a href={`/works/${savedSlug}`} target="_blank" rel="noreferrer noopener" className="underline">查看公开详情页</a>
          {' · '}<a href={`/admin/works/${savedId}/edit`} className="underline">继续编辑</a>
        </p>
      )}
      {uploadError && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">上传失败：{uploadError}（表单其他内容已保留）</p>}

      {/* A. 基本信息 */}
      <section className={sectionCls}>
        <h2 className="font-semibold">A. 基本信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>标题* <span className="text-muted2">（{form.title.length}/100）</span>
            <input id="field-title" maxLength={100} value={form.title} onChange={(e) => onTitle(e.target.value)} className={fieldCls} placeholder="例如：AI 个人作品集" />
            {fieldErr('title')}
          </label>
          <label className={labelCls}>别名（slug）* <span className="text-muted2">（小写字母、数字、连字符）</span>
            <div className="flex gap-2">
              <input id="field-slug" maxLength={100} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }} className={fieldCls} placeholder="my-work" />
              <button type="button" onClick={async () => { const r = await checkSlugAction(form.slug, work?.id ?? savedId ?? null); setSlugCheck(r.message); }} className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-sm">检查可用性</button>
            </div>
            {slugCheck && <p className="mt-1 text-xs text-muted2">{slugCheck}</p>}
            {fieldErr('slug')}
          </label>
        </div>
        <label className={labelCls}>简介* <span className="text-muted2">（{form.summary.length}/300）</span>
          <textarea id="field-summary" maxLength={300} value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={2} className={fieldCls} />
          {fieldErr('summary')}
        </label>
        <label className={labelCls}>完整描述 <span className="text-muted2">（{form.description.length}/5000）</span>
          <textarea id="field-description" maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} className={fieldCls} />
          {fieldErr('description')}
        </label>
        <label className={labelCls}>主要功能与设计亮点（每行一条，详情页有内容时才显示该栏目）
          <textarea value={form.highlightsStr} onChange={(e) => set('highlightsStr', e.target.value)} rows={3} className={fieldCls} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>分类*
            <select id="field-category" value={form.category} onChange={(e) => set('category', e.target.value)} className={fieldCls}>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            {fieldErr('category')}
          </label>
          <label className={labelCls}>标签（逗号分隔）
            <input value={form.tagsStr} onChange={(e) => set('tagsStr', e.target.value)} className={fieldCls} placeholder="Next.js，Supabase" />
          </label>
        </div>
      </section>

      {/* B. 作品媒体 */}
      <section className={sectionCls}>
        <h2 className="font-semibold">B. 作品媒体</h2>
        <p className="text-sm text-muted2">只接受 JPEG、PNG、WebP、GIF、AVIF，单张不超过 5MB；文件名会自动加时间戳与随机串，不会覆盖他人图片。</p>
        <div>
          <p className="text-sm font-medium">封面图</p>
          <div className="relative mt-2 aspect-[16/9] max-w-md overflow-hidden rounded-2xl border border-white/10">
            <CoverImage src={form.cover || null} title={form.title || '封面预览'} sizes="(max-width: 640px) 100vw, 448px" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" aria-label="上传封面图" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); }} className="text-sm" />
            {form.cover && <button type="button" onClick={() => set('cover', '')} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm">删除封面</button>}
            {coverProgress !== null && <span className="text-sm text-muted2">上传中 {coverProgress}%</span>}
          </div>
          <label className={labelCls}>封面图片 URL（也可直接填写）
            <input value={form.cover} onChange={(e) => set('cover', e.target.value)} className={fieldCls} />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium">作品截图（可多张）</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {form.gallery.map((src, i) => (
              <div key={`${src}-${i}`} className="relative">
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10">
                  <CoverImage src={src} title={form.title || '截图'} sizes="(max-width: 640px) 100vw, 50vw" />
                </div>
                <button type="button" onClick={() => set('gallery', form.gallery.filter((_, j) => j !== i))} className="mt-1 rounded-lg bg-white/10 px-2 py-1 text-xs">删除这张</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" multiple aria-label="上传作品截图" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => void uploadGallery(e.target.files)} className="text-sm" />
            {galleryProgress && <span className="text-sm text-muted2">{galleryProgress}</span>}
          </div>
          <label className={labelCls}>画廊图片 URL（每行一个，也可直接填写）
            <textarea value={form.gallery.join('\n')} onChange={(e) => set('gallery', e.target.value.split(/\n+/).map((t) => t.trim()).filter(Boolean))} rows={3} className={fieldCls} />
          </label>
        </div>
      </section>

      {/* C. 作品链接 */}
      <section className={sectionCls}>
        <h2 className="font-semibold">C. 作品链接</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>在线体验地址 demo_url
            <input id="field-demo_url" value={form.demo_url} onChange={(e) => set('demo_url', e.target.value)} className={fieldCls} placeholder="https://…" />
            {fieldErr('demo_url')}
          </label>
          <label className={labelCls}>源代码地址 source_url
            <input id="field-source_url" value={form.source_url} onChange={(e) => set('source_url', e.target.value)} className={fieldCls} placeholder="https://…" />
            {fieldErr('source_url')}
          </label>
        </div>
        <label className={labelCls}>旧仓库链接 repo_url（兼容字段；详情页优先用 source_url）
          <input value={form.repo_url} onChange={(e) => set('repo_url', e.target.value)} className={fieldCls} placeholder="https://…" />
          {fieldErr('repo_url')}
        </label>
        <div>
          <p className="text-sm font-medium">相关外部链接</p>
          {form.external_links.map((l, i) => (
            <div key={i} className="mt-2 flex flex-wrap gap-2">
              <input value={l.label} aria-label={`外部链接名称 ${i + 1}`} onChange={(e) => set('external_links', form.external_links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="名称" className={`${fieldCls} w-40`} />
              <input value={l.url} aria-label={`外部链接地址 ${i + 1}`} onChange={(e) => set('external_links', form.external_links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" className={`${fieldCls} flex-1`} />
              <button type="button" onClick={() => set('external_links', form.external_links.filter((_, j) => j !== i))} className="rounded-xl border border-white/15 px-3 py-2 text-sm">删除</button>
            </div>
          ))}
          <button type="button" onClick={() => set('external_links', [...form.external_links, { label: '', url: '' }])} className="mt-2 rounded-xl border border-white/15 px-3 py-2 text-sm">+ 添加链接</button>
          {fieldErr('external_links')}
        </div>
      </section>

      {/* D. 展示设置 */}
      <section className={sectionCls}>
        <h2 className="font-semibold">D. 展示设置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>发布状态
            <select value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])} className={fieldCls}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已下架</option>
            </select>
          </label>
          <label className={labelCls}>排序值
            <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={fieldCls} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
          设为首页精选（精选作品必须是已发布作品；状态不是已发布时保存会报错，不会静默取消精选）
        </label>
        {fieldErr('featured')}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>项目开始日期（可选）
            <input type="date" value={form.started_at} onChange={(e) => set('started_at', e.target.value)} className={fieldCls} />
          </label>
          <p className="text-sm text-muted2">
            首次发布时间：
            {work?.published_at
              ? ` ${new Date(work.published_at).toLocaleString('zh-CN')}（后续编辑与重新上架不会重置）`
              : ' 尚未首次发布，首次发布后自动记录'}
          </p>
        </div>
      </section>

      {/* E. SEO 设置 */}
      <section className={sectionCls}>
        <h2 className="font-semibold">E. SEO 设置</h2>
        <label className={labelCls}>SEO 标题 <span className="text-muted2">（{form.seo_title.length}/100，留空则用作品标题）</span>
          <input maxLength={100} value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} className={fieldCls} />
          {fieldErr('seo_title')}
        </label>
        <label className={labelCls}>SEO 描述 <span className="text-muted2">（{form.seo_description.length}/300，留空则用简介）</span>
          <textarea maxLength={300} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} rows={2} className={fieldCls} />
          {fieldErr('seo_description')}
        </label>
        <div>
          <p className="text-sm font-medium">社交分享图片（可选，留空则用封面）</p>
          {form.og_image_url && (
            <div className="relative mt-2 aspect-[16/9] max-w-md overflow-hidden rounded-2xl border border-white/10">
              <CoverImage src={form.og_image_url} title="分享图片预览" sizes="(max-width: 640px) 100vw, 448px" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" aria-label="上传分享图片" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadOg(f); }} className="text-sm" />
            {form.og_image_url && <button type="button" onClick={() => set('og_image_url', '')} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm">删除</button>}
            {ogProgress !== null && <span className="text-sm text-muted2">上传中 {ogProgress}%</span>}
          </div>
          <label className={labelCls}>分享图片 URL（也可直接填写）
            <input value={form.og_image_url} onChange={(e) => set('og_image_url', e.target.value)} className={fieldCls} />
          </label>
        </div>
      </section>

      {errors.form && <p className="text-sm text-red-300">{errors.form}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void submit('draft')} className="min-h-[44px] rounded-xl border border-white/15 px-5 py-2.5 text-sm disabled:opacity-50">
          {saving ? '保存中…' : '保存草稿'}
        </button>
        <button type="button" disabled={saving} onClick={() => void submit('published')} className="min-h-[44px] rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black disabled:opacity-50">
          {saving ? '保存中…' : '发布作品'}
        </button>
        <Link href="/admin/works" onClick={onCancel} className="flex min-h-[44px] items-center rounded-xl border border-white/15 px-5 py-2.5 text-sm">
          取消编辑
        </Link>
      </div>
    </div>
  );
}
