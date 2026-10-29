import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getRepository, getMode } from '@/lib/data/repository';
import AdminNav from '@/components/AdminNav';
import { formatDate, statusLabel } from '@/lib/utils';

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect('/admin/login');
  const repo = await getRepository();
  const all = await repo.listAll();
  const count = (s: string) => all.filter((w) => w.status === s).length;
  const stats = [
    { label: '作品总数', value: all.length },
    { label: '已发布', value: count('published') },
    { label: '草稿', value: count('draft') },
    { label: '已下架', value: count('archived') },
    { label: '精选作品', value: all.filter((w) => w.featured).length },
  ];
  const recent = [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  return (
    <div className="space-y-6"><AdminNav />
      <div><h1 className="text-2xl font-bold">仪表盘</h1><p className="mt-1 text-sm text-muted2">当前数据模式：{getMode() === 'demo' ? '本地演示（data/works.json）' : 'Supabase'} · 以下统计均来自真实数据层，不是写死的数字。</p></div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">{stats.map((s) => <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-3xl font-bold">{s.value}</p><p className="mt-1 text-sm text-muted2">{s.label}</p></div>)}</div>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/works/new" className="min-h-[40px] rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">新建作品</Link>
        <Link href="/works" target="_blank" rel="noreferrer noopener" className="min-h-[40px] rounded-full border border-white/15 px-5 py-2.5 text-sm">查看公开网站</Link>
        <Link href="/admin/works" className="min-h-[40px] rounded-full border border-white/15 px-5 py-2.5 text-sm">查看全部作品</Link>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-semibold">最近更新</h2>
        <ul className="mt-3 space-y-2">
          {recent.map((w) => (
            <li key={w.id} className="flex flex-wrap justify-between gap-3 text-sm">
              <Link href={`/admin/works/${w.id}/edit`} className="hover:underline">{w.title}</Link>
              <span className="text-muted2">{statusLabel(w.status)} · 更新于 {formatDate(w.updated_at)}</span>
            </li>
          ))}
        </ul>
        {recent.length === 0 && <p className="mt-3 text-sm text-muted2">还没有作品，先新建一件吧。</p>}
      </div>
    </div>
  );
}
