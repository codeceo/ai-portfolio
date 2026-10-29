'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
export default function SupabaseLoginForm() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const sb = createBrowserSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    // Generic message only: never reveal whether the email exists or
    // which field failed, and never surface the provider's raw error.
    if (error) setMsg('邮箱或密码错误，请重试');
    else router.push('/admin');
  }
  const field = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none';
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={field} /></label>
      <label className="block text-sm">密码<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className={field} /></label>
      {msg && <p className="text-sm text-red-300">{msg}</p>}
      <button className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black">登录后台</button>
    </form>
  );
}
