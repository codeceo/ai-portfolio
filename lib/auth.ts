import { cookies } from 'next/headers';
import { getMode } from './data/repository';

export const DEMO_COOKIE = 'ai-portfolio-demo-admin';

/**
 * Central admin check. This is the ONLY gate server actions, the admin
 * layout and the upload route use — hiding a menu is never protection.
 * - Demo mode (no Supabase env): the local demo cookie. Demo-only, never
 *   a production credential.
 * - Supabase mode: a valid Supabase session AND a row in public.admins
 *   for that user id. Any authenticated non-admin user is rejected.
 */
export async function isAdmin(): Promise<boolean> {
  if (getMode() === 'demo') return cookies().get(DEMO_COOKIE)?.value === '1';
  try {
    const { createServerSupabase } = await import('./supabase/server');
    const sb = createServerSupabase();
    const { data } = await sb.auth.getUser();
    const user = data.user;
    if (!user) return false;
    const { data: row, error } = await sb
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return false;
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('未登录或无管理员权限');
}
