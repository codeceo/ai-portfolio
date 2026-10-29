import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isAdmin } from '@/lib/auth';

/**
 * Central server guard for every /admin route except /admin/login.
 * FAIL-CLOSED: the guard runs unless the path is exactly /admin/login.
 * The previous version only guarded when middleware had set the
 * x-admin-path header (path && ...), so a request that reached this
 * layout without that header — middleware matcher gap, header stripped
 * by a proxy, future route change — would have rendered the admin page
 * unguarded. Per-page checks remain as a second layer, and every server
 * action re-checks via requireAdmin().
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = headers().get('x-admin-path') ?? '';
  if (path !== '/admin/login' && !(await isAdmin())) {
    redirect('/admin/login');
  }
  return <div>{children}</div>;
}
