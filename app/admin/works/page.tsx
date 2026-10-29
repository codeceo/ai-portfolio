import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getRepository } from '@/lib/data/repository';
import AdminNav from '@/components/AdminNav';
import AdminWorksClient from '@/components/AdminWorksClient';

export default async function AdminWorks({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; category?: string; sort?: string };
}) {
  if (!(await isAdmin())) redirect('/admin/login');
  const repo = await getRepository();
  const [all, cats] = await Promise.all([repo.listAll(), repo.listCategories()]);
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status ?? '';
  const category = searchParams.category ?? '';
  const sort = searchParams.sort ?? 'updated_desc';
  let works = all;
  if (q) works = works.filter((w) => w.title.toLowerCase().includes(q.toLowerCase()));
  if (status) works = works.filter((w) => w.status === status);
  if (category) works = works.filter((w) => w.category === category);
  works = [...works].sort((a, b) =>
    sort === 'updated_asc'
      ? a.updated_at.localeCompare(b.updated_at)
      : b.updated_at.localeCompare(a.updated_at),
  );
  return (
    <div className="space-y-6"><AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">作品管理</h1>
        <Link href="/admin/works/new" className="min-h-[40px] rounded-full bg-white px-4 py-2 text-sm font-medium text-black">新建作品</Link>
      </div>
      <AdminWorksClient works={works} categories={cats} params={{ q, status, category, sort }} total={all.length} />
    </div>
  );
}
