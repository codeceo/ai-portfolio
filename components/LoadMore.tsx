'use client';
import { useState } from 'react';
import type { Category, Work } from '@/lib/types';
import WorkCard from './WorkCard';
import { categoryName } from '@/lib/site';

export default function LoadMore({
  initialWorks, total, categories, filters, pageSize = 9,
}: {
  initialWorks: Work[]; total: number; categories: Category[];
  filters: { category?: string; tag?: string; q?: string; sort?: string };
  pageSize?: number;
}) {
  const [works, setWorks] = useState<Work[]>(initialWorks);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMore = async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (filters.category) p.set('category', filters.category);
      if (filters.tag) p.set('tag', filters.tag);
      if (filters.q) p.set('q', filters.q);
      if (filters.sort) p.set('sort', filters.sort);
      const res = await fetch(`/api/works?${p.toString()}`);
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setWorks((prev) => [...prev, ...(data.works as Work[])]);
      setPage((v) => v + 1);
    } catch {
      setError('加载失败，请重试。');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {works.map((w) => (
          <WorkCard key={w.id} work={w} categoryName={categoryName(categories, w.category)} />
        ))}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {works.length < total ? (
        <div className="text-center">
          <button onClick={loadMore} disabled={loading} className="min-h-[44px] rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black disabled:opacity-50">
            {loading ? '加载中…' : '加载更多'}
          </button>
          <p className="mt-2 text-sm text-muted2">已显示 {works.length} / 共 {total} 件</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted2">已显示全部 {total} 件作品</p>
      )}
    </div>
  );
}
