import { NextResponse, type NextRequest } from 'next/server';

/**
 * First gate for /admin/* (except /admin/login): redirect visitors with
 * neither a demo admin cookie nor a Supabase auth cookie to the login
 * page. This is UX routing only — the real check is lib/auth.ts isAdmin()
 * (session + public.admins allowlist), enforced in the admin layout,
 * every server action and the upload route. A forged cookie alone grants
 * nothing beyond reaching the login redirect target.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') {
    const res = NextResponse.next();
    res.headers.set('x-admin-path', pathname);
    return res;
  }
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  const hasDemo = req.cookies.get('ai-portfolio-demo-admin')?.value === '1';
  const hasSupabaseSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (hasDemo || hasSupabaseSession) {
    const res = NextResponse.next();
    res.headers.set('x-admin-path', pathname);
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  return NextResponse.redirect(url);
}

// '/admin' itself is listed explicitly: '/admin/:path*' alone is easy to
// misread as covering the bare path, and the layout guard must never
// depend on this matcher being the only protection (see layout.tsx).
export const config = { matcher: ['/admin', '/admin/:path*'] };
