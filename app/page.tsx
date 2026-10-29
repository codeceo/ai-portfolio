// Force-dynamic: admin publishes must appear on the home page immediately
// (the same reason /works is dynamic); revalidatePath from server actions
// is kept as well, but freshness must not depend on a static prerender.
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getRepository } from '@/lib/data/repository';
import { site } from '@/lib/site';
import WorkGrid from '@/components/WorkGrid';
import CategoryFilter from '@/components/CategoryFilter';

export default async function Home() {
  const repo = await getRepository();
  const [manual, latest, cats] = await Promise.all([
    repo.listPublished({ sort: 'manual' }),
    repo.listPublished({ sort: 'latest' }),
    repo.listCategories(),
  ]);
  const featured = manual.filter((w) => w.featured);
  const latestSix = latest.slice(0, 6);

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="relative pt-10 sm:pt-16">
        <div aria-hidden className="hero-glow pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-[#7c7fc4]/20 blur-[100px]" />
        <p className="text-sm tracking-[0.2em] text-lavender">个人 AI 产品作品展厅</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          {site.heroTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-xl leading-relaxed sm:text-2xl">{site.heroSubtitle}</p>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted2">{site.heroHelper}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/works" className="flex min-h-[44px] items-center gap-1 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black">
            浏览全部作品 <ArrowRight size={16} />
          </Link>
          <Link href="/about" className="flex min-h-[44px] items-center rounded-full border border-white/15 px-6 py-2.5 text-sm hover:bg-white/10">
            了解我的创作
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">精选作品</h2>
            <Link href="/works" className="text-sm text-lavender">查看全部 →</Link>
          </div>
          <WorkGrid works={featured} categories={cats} featuredLayout />
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">最新作品</h2>
          <Link href="/works" className="text-sm text-lavender">查看全部 →</Link>
        </div>
        <WorkGrid works={latestSix} categories={cats} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">按分类浏览</h2>
        <Suspense fallback={<div className="text-muted2">加载分类…</div>}>
          <CategoryFilter categories={cats} mode="home" />
        </Suspense>
      </section>

      <section className="surface rounded-2xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold">关于创作者</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted2">{site.creatorIntro}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/about" className="flex min-h-[44px] items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">了解我的创作</Link>
          <Link href={site.contactHref} className="flex min-h-[44px] items-center rounded-full border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">{site.contactLabel}</Link>
        </div>
      </section>
    </div>
  );
}
