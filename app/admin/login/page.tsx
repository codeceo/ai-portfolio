import { redirect } from 'next/navigation';
import { getMode } from '@/lib/data/repository';
import { isAdmin } from '@/lib/auth';
import DemoLoginForm from '@/components/DemoLoginForm';
import SupabaseLoginForm from '@/components/SupabaseLoginForm';
export default async function AdminLogin() {
  if (await isAdmin()) redirect('/admin');
  const mode = getMode();
  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">管理员登录</h1>
      <p className="mt-2 text-sm text-muted2">当前模式：{mode === 'demo' ? '本地演示' : 'Supabase'}</p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {mode === 'demo' ? <DemoLoginForm /> : <SupabaseLoginForm />}
      </div>
      {mode === 'supabase' && <p className="mt-4 text-sm text-muted2">请在 Supabase Auth 中关闭公开注册，仅通过邀请创建管理员账号。</p>}
    </div>
  );
}
