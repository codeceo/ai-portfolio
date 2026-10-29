'use client';
import { useFormState } from 'react-dom';
import { createCategoryAction } from '@/lib/admin-actions';
export default function CategoryForm() {
  const [state, action] = useFormState(createCategoryAction, { ok: false, message: '' });
  const field = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none';
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4">
      <input name="name" required placeholder="分类名称" aria-label="分类名称" className={field} />
      <input name="slug" required placeholder="别名，如 web" aria-label="分类别名" className={field} />
      <input name="description" placeholder="描述（可选）" aria-label="分类描述（可选）" className={field} />
      <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">新增分类</button>
      {state.message && <p className={`text-sm sm:col-span-4 ${state.ok ? 'text-emerald-300' : 'text-red-300'}`}>{state.message}</p>}
    </form>
  );
}
