'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Category } from '@/lib/types';

/**
 * Reusable category filter. Categories always come from the database.
 * mode="home": links to /works?category=slug. mode="works": preserves other
 * /works query params (q, tag, sort) while changing the category.
 * "全部" is the only fixed label.
 */
export default function CategoryFilter({
  categories, selected, mode = 'home',
}: { categories: Category[]; selected?: string; mode?: 'home' | 'works' }) {
  const sp = useSearchParams();
  const current = selected ?? (mode === 'works' ? (sp.get('category') ?? '') : '');
  const hrefFor = (slug: string) => {
    if (mode === 'home') return slug ? `/works?category=${slug}` : '/works';
    const p = new URLSearchParams(sp.toString());
    if (slug) p.set('category', slug); else p.delete('category');
    const s = p.toString(); return s ? `/works?${s}` : '/works';
  };
  const cls = (active: boolean) =>
    `min-h-[40px] rounded-full px-4 py-2 text-sm transition focus-visible:outline-2 ${active ? 'bg-white text-black' : 'surface hover:bg-white/10'}`;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="按分类筛选">
      <Link href={hrefFor('')} className={cls(!current)} aria-current={!current ? 'true' : undefined}>全部</Link>
      {categories.map((c) => (
        <Link key={c.id} href={hrefFor(c.slug)} className={cls(current === c.slug)} aria-current={current === c.slug ? 'true' : undefined}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
