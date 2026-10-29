import Link from 'next/link';
import { site } from '@/lib/site';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <div className="surface flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">{site.brand}</p>
          <p className="mt-1 text-sm text-muted2">{site.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {site.socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener" className="flex min-h-[40px] items-center rounded-full border border-white/15 px-4 text-sm hover:bg-white/10">
              {s.label}
            </a>
          ))}
          <Link href="/admin" className="flex min-h-[40px] items-center rounded-full px-3 text-sm text-muted2 hover:text-white">管理后台</Link>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted2">
        © {year} {site.copyright} · 作品来自统一数据层，公共页仅展示已发布作品
      </p>
    </footer>
  );
}
