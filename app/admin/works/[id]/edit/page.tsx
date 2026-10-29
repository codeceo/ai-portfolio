import { redirect, notFound } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { getRepository } from '@/lib/data/repository';
import AdminNav from '@/components/AdminNav';
import WorkForm from '@/components/WorkForm';
export default async function EditWork({ params }: { params: { id: string } }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const repo = await getRepository();
  const [work, cats] = await Promise.all([repo.getById(params.id), repo.listCategories()]);
  if (!work) notFound();
  return <div className="space-y-6"><AdminNav /><h1 className="text-2xl font-bold">编辑作品：{work.title}</h1><WorkForm work={work} categories={cats} /></div>;
}
