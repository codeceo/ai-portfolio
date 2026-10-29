import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';
import type { Work } from '@/lib/types';
import CoverImage from './CoverImage';

export default function WorkCard({
  work, categoryName, large = false, priority = false,
}: { work: Work; categoryName?: string; large?: boolean; priority?: boolean }) {
  return (
    <Link
      href={`/works/${work.slug}`}
      className={`surface card-hover group flex min-w-0 flex-col overflow-hidden rounded-2xl focus-visible:outline-2 ${large ? 'lg:col-span-2' : ''}`}
    >
      <div className={`relative ${large ? 'aspect-[16/9] lg:aspect-[21/9]' : 'aspect-[16/9]'} bg-coal`}>
        <CoverImage
          src={work.cover_image_url} title={work.title} priority={priority}
          sizes={large ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 66vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
          className="transition duration-300 group-hover:scale-[1.03]"
        />
        {work.featured && (
          <span className="glass absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
            <Star size={13} />精选
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="text-xs text-lavender">{categoryName ?? work.category}</div>
        <h3 className="mt-1 break-words text-lg font-semibold leading-snug">{work.title}</h3>
        <p className="mt-1.5 break-words line-clamp-2 text-sm leading-relaxed text-muted2">{work.summary}</p>
        {work.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {work.tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        )}
        <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-lavender">
          查看作品 <ArrowUpRight size={15} />
        </span>
      </div>
    </Link>
  );
}
