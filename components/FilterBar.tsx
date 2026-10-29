'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useEffect } from 'react';
import type { Category } from '@/lib/types';
import CategoryFilter from './CategoryFilter';

export default function FilterBar({
  categories, tags, sort,
}: { categories: Category[]; tags: string[]; sort?: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const cat = sp.get('category') ?? '';
  const tag = sp.get('tag') ?? '';
  const q = sp.get('q') ?? '';
  const hasFilter = Boolean(cat || tag || q || (sort && sort !== 'latest'));

  // Header search icon links to /works#search — focus the input on arrival,
  // and also when the hash changes while already on /works (client-side
  // navigation does not remount this component, so mount-only focus
  // would silently do nothing on the second click).
  useEffect(() => {
    const focusSearch = () => {
      if (window.location.hash === '#search') {
        document.getElementById('search')?.focus();
      }
    };
    focusSearch();
    window.addEventListener('hashchange', focusSearch);
    return () => window.removeEventListener('hashchange', focusSearch);
  }, []);

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
    const s = p.toString(); return s ? `/works?${s}` : '/works';
  };

  const onSort = (value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value === 'latest') p.delete('sort'); else p.set('sort', value);
    const s = p.toString();
    router.push(s ? `/works?${s}` : '/works');
  };

  return (
    <div className="glass space-y-4 rounded-2xl p-4">
      <form action="/works" className="flex gap-2" role="search">
        <label className="flex min-h-[40px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
          <Search size={16} className="shrink-0 text-muted2" />
          <input
            id="search" name="q" defaultValue={q}
            placeholder="搜索标题、简介或标签…"
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted2"
          />
        </label>
        <button className="min-h-[40px] rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">搜索</button>
      </form>

      <CategoryFilter categories={categories} mode="works" />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ tag: '' })} className={`min-h-[40px] rounded-full border px-3 py-2 text-xs ${!tag ? 'border-white bg-white text-black' : 'border-white/15'}`}>全部标签</Link>
          {tags.map((t) => (
            <Link key={t} href={href({ tag: t })} className={`min-h-[40px] rounded-full border px-3 py-2 text-xs ${tag === t ? 'border-white bg-white text-black' : 'border-white/15'}`}>{t}</Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          排序
          <select
            value={sort ?? 'latest'} onChange={(e) => onSort(e.target.value)}
            className="min-h-[40px] rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
          >
            <option value="latest">最新发布</option>
            <option value="manual">手动排序</option>
          </select>
        </label>
        {hasFilter && (
          <Link href="/works" className="flex min-h-[40px] items-center rounded-full border border-white/15 px-4 text-sm hover:bg-white/10">
            清空筛选
          </Link>
        )}
      </div>
    </div>
  );
}
