import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getRepository } from '@/lib/data/repository';
import AdminNav from '@/components/AdminNav';
import CategoryForm from '@/components/CategoryForm';
import CategoryRowActions from '@/components/CategoryRowActions';
export default async function CategoriesPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const repo = await getRepository();
  const cats = await repo.listCategories();
  return (
    <div className="space-y-6"><AdminNav />
      <h1 className="text-2xl font-bold">分类管理</h1>
      <CategoryForm />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <ul className="space-y-3">{cats.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3"><span>{c.name} <span className="text-muted2">({c.slug})</span></span><CategoryRowActions id={c.id} /></li>)}</ul>
        {cats.length === 0 && <p className="text-sm text-muted2">还没有分类。</p>}
      </div>
    </div>
  );
}
