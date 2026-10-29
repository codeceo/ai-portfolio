'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { site } from '@/lib/site';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/works', label: '作品' },
  { href: '/about', label: '关于' },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('ai-lab-theme');
    const t = saved === 'light' ? 'light' : 'dark';
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ai-lab-theme', next);
  };

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const linkCls = (href: string) =>
    `flex min-h-[40px] items-center rounded-full px-3 py-1.5 text-sm transition ${isActive(href) ? 'bg-white text-black' : 'hover:bg-white/10'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6">
      <div
        className={`glass mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 py-2 transition sm:px-4 ${
          scrolled ? 'bg-white/[0.10]' : ''
        }`}
      >
        <Link href="/" className="flex min-h-[40px] items-center gap-2 text-base font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c7fc4] to-[#a5a8d8] text-sm font-bold text-white">◆</span>
          {site.brand}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.href)} aria-current={isActive(n.href) ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link href="/works#search" aria-label="搜索作品" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
            <Search size={18} />
          </Link>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href={site.contactHref} className="hidden min-h-[40px] items-center rounded-full border border-white/15 px-4 text-sm sm:flex">
            {site.contactLabel}
          </Link>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? '关闭菜单' : '打开菜单'} aria-expanded={open} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl rounded-2xl p-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block rounded-xl px-4 py-3 text-sm ${isActive(n.href) ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
              {n.label}
            </Link>
          ))}
          <Link href={site.contactHref} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10">{site.contactLabel}</Link>
          <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10">管理后台</Link>
        </div>
      )}
    </header>
  );
}
