'use client';
import { useFormState } from 'react-dom';
import { demoLoginAction } from '@/lib/admin-actions';
export default function DemoLoginForm() {
  const [state, action] = useFormState(demoLoginAction, { ok: false, message: '' });
  const field = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none';
  return (
    <form action={action} className="space-y-4">
      <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">演示模式：未配置 Supabase 时可用本地演示账号登录（见 README，仅限本地演示）。</p>
      <label className="block text-sm">邮箱<input name="email" type="email" required className={field} placeholder="admin@demo.local" /></label>
      <label className="block text-sm">密码<input name="password" type="password" required className={field} /></label>
      {state.message && <p className="text-sm text-red-300">{state.message}</p>}
      <button className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black">登录后台</button>
    </form>
  );
}
