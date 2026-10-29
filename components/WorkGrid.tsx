import type { Category, Work } from '@/lib/types';
import { categoryName } from '@/lib/site';
import WorkCard from './WorkCard';
import EmptyState from './EmptyState';

export default function WorkGrid({
  works, categories = [], featuredLayout = false,
}: { works: Work[]; categories?: Category[]; featuredLayout?: boolean }) {
  if (!works.length) return <EmptyState title="还没有符合条件的作品" hint="换一个分类、标签或关键词试试，或到后台发布作品。" />;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {works.map((w, i) => (
        <WorkCard
          key={w.id} work={w}
          categoryName={categoryName(categories, w.category)}
          large={featuredLayout && i === 0}
          priority={featuredLayout && i === 0}
        />
      ))}
    </div>
  );
}
