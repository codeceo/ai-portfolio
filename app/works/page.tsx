import { Suspense } from 'react';
import { getRepository } from '@/lib/data/repository';
import type { WorkSort } from '@/lib/data/repository';
import FilterBar from '@/components/FilterBar';
import LoadMore from '@/components/LoadMore';
import EmptyState from '@/components/EmptyState';

const PAGE_SIZE = 9;

export default async function WorksPage({
  searchParams,
}: {
  searchParams: { category?: string; tag?: string; q?: string; sort?: string };
}) {
  const sort: WorkSort = searchParams.sort === 'manual' ? 'manual' : 'latest';
  const repo = await getRepository();
  const [paged, cats, tags] = await Promise.all([
    repo.listPublishedPaged({ category: searchParams.category, tag: searchParams.tag, q: searchParams.q, sort, page: 1, pageSize: PAGE_SIZE }),
    repo.listCategories(),
    repo.listTags(),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">全部作品</h1>
        <p className="mt-2 text-muted2">仅展示已发布作品。草稿与已下架作品不会出现在这里。</p>
      </div>
      <Suspense fallback={<div className="text-muted2">加载筛选器…</div>}>
        <FilterBar categories={cats} tags={tags} sort={sort} />
      </Suspense>
      <p className="text-sm text-muted2">共 {paged.total} 件作品</p>
      {paged.total === 0 ? (
        <EmptyState title="没有找到符合条件的作品" hint="换一个关键词、分类或标签试试，或清空筛选查看全部作品。" />
      ) : (
        <LoadMore
          initialWorks={paged.works} total={paged.total} categories={cats} pageSize={PAGE_SIZE}
          filters={{ category: searchParams.category, tag: searchParams.tag, q: searchParams.q, sort }}
        />
      )}
    </div>
  );
}
