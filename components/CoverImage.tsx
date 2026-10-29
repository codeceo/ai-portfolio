'use client';
import Image from 'next/image';
import { useState } from 'react';
import { site } from '@/lib/site';
import { isSafeImageUrl } from '@/lib/safe-url';

export function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div
      aria-label={title}
      className="grid h-full w-full place-items-center bg-gradient-to-br from-[#2a2a4a] via-[#1a1a2e] to-[#101018] text-white"
    >
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-bold">◆</span>
        <span className="text-xs tracking-widest opacity-70">{site.brand}</span>
      </div>
    </div>
  );
}

export default function CoverImage({
  src, title, className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
}: {
  src: string | null; title: string; className?: string;
  /** Per-usage sizes so next/image serves a fitting width, not the largest. */
  sizes?: string;
  /** Only for the above-the-fold hero / first featured cover. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Defence in depth: a stored cover/gallery URL that is not a safe
  // image source (e.g. javascript:/data: smuggled past validation or
  // written directly to the DB) renders as a placeholder, never as <img>.
  if (!src || !isSafeImageUrl(src) || failed) return <CoverPlaceholder title={title} />;
  return (
    <Image
      src={src} alt={title} fill sizes={sizes} priority={priority}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
