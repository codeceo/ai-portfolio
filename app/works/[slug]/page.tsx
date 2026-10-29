import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Github, ArrowLeft, Sparkles } from 'lucide-react';
import { getRepository } from '@/lib/data/repository';
import { safeHref, safeImgSrc } from '@/lib/safe-url';
import { formatDate } from '@/lib/utils';
import { categoryName, site, siteUrl } from '@/lib/site';
import CoverImage from '@/components/CoverImage';
import WorkGrid from '@/components/WorkGrid';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const repo = await getRepository();
  const work = await repo.getBySlug(params.slug);
  if (!work || work.status !== 'published') return { title: '作品不存在' };
  const url = `${siteUrl()}/works/${work.slug}`;
  const title = work.seo_title || work.title;
  const description = work.seo_description || work.summary;
  // Unpublished works return above with only a generic title, so no
  // title/summary/cover ever leaks into metadata for them. Even for
  // published works, an unsafe OG image source is dropped, not emitted.
  const ogImage = safeImgSrc(work.og_image_url || work.cover_image_url);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${site.brand}`,
      description,
      url,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function WorkDetail({ params }: { params: { slug: string } }) {
  const repo = await getRepository();
  const work = await repo.getBySlug(params.slug);
  if (!work || work.status !== 'published') notFound();
  const [cats, sameCategory] = await Promise.all([repo.listCategories(), repo.listPublished({ category: work.category })]);
  const catName = categoryName(cats, work.category);
  const related = sameCategory.filter((w) => w.id !== work.id).slice(0, 3);
  const highlights = work.highlights ?? [];
  // Defence in depth: listPublished already guarantees `related` is
  // published-only, and these filters guarantee no stored javascript:/
  // data: URL is ever rendered as a clickable link, even if validation
  // was bypassed when the row was written.
  const demoHref = safeHref(work.demo_url);
  const sourceHref = safeHref(work.source_url || work.repo_url);
  const safeExternalLinks = (work.external_links ?? []).filter((l) => safeHref(l.url));

  return (
    <article className="space-y-8">
      <Link href="/works" className="flex min-h-[40px] items-center gap-1 text-sm text-muted2 hover:text-white"><ArrowLeft size={15} />返回全部作品</Link>
      <div>
        <p className="text-sm text-lavender">{catName} · {formatDate(work.created_at)}</p>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{work.title}</h1>
        <p className="mt-3 max-w-3xl break-words leading-relaxed text-muted2">{work.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">{work.tags.map((t) => <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs">{t}</span>)}</div>
      </div>

      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-coal">
        <CoverImage src={work.cover_image_url} title={work.title} priority sizes="(max-width: 1152px) 100vw, 1152px" />
      </div>

      {work.description && <div className="max-w-3xl break-words whitespace-pre-wrap leading-relaxed">{work.description}</div>}

      {highlights.length > 0 && (
        <section className="surface max-w-3xl rounded-2xl p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={17} />主要功能与设计亮点</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted2">
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </section>
      )}

      {work.gallery_images.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold">更多截图</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {work.gallery_images.map((src) => (
              <div key={src} className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-coal">
                <CoverImage src={src} title={work.title} sizes="(max-width: 640px) 100vw, 50vw" />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {demoHref ? (
          <a href={demoHref} target="_blank" rel="noreferrer noopener" className="flex min-h-[44px] items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">
            在线体验 <ExternalLink size={15} />
          </a>
        ) : null}
        {sourceHref ? (
          <a href={sourceHref} target="_blank" rel="noreferrer noopener" className="flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-5 py-2.5 text-sm">
            <Github size={15} />查看源代码
          </a>
        ) : null}
        {safeExternalLinks.map((l) => (
          <a key={`${l.label}-${l.url}`} href={l.url} target="_blank" rel="noreferrer noopener" className="flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-5 py-2.5 text-sm">
            {l.label} <ExternalLink size={15} />
          </a>
        ))}
      </div>
      {work.started_at && (
        <p className="text-sm text-muted2">项目开始于 {formatDate(work.started_at)}</p>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">相关作品</h2>
          <WorkGrid works={related} categories={cats} />
        </section>
      )}
    </article>
  );
}
