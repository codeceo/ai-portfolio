import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getRepository } from '@/lib/data/repository';
import AdminNav from '@/components/AdminNav';
import WorkForm from '@/components/WorkForm';
export default async function NewWork() {
  if (!(await isAdmin())) redirect('/admin/login');
  const repo = await getRepository();
  const cats = await repo.listCategories();
  return <div className="space-y-6"><AdminNav /><h1 className="text-2xl font-bold">新建作品</h1><WorkForm categories={cats} /></div>;
}
