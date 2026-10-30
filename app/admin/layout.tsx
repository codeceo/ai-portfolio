import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isAdmin } from '@/lib/auth';

/**
 * Central server guard for every /admin route except /admin/login.
 * FAIL-CLOSED: the guard runs unless the path is exactly /admin/login.
 * The path arrives as the x-admin-path REQUEST header set by
 * middleware (see middleware.ts). It must stay a request header:
 * a response header does not reach headers() on hosted runtimes
 * (Netlify/OpenNext), which made the layout redirect /admin/login
 * to itself and left an empty <main> on the live site.
 * A request that reaches this layout without that header is
 * therefore guarded (redirected to /admin/login) — never rendered
 * unguarded. Per-page checks remain as a second layer, and every
 * server action re-checks via requireAdmin().
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = headers().get('x-admin-path') ?? '';
  if (path !== '/admin/login' && !(await isAdmin())) {
    redirect('/admin/login');
  }
  return <div>{children}</div>;
}
