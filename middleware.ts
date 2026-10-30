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
  // Pass the pathname to server components as a REQUEST header.
  // Setting it on the response (res.headers.set) does NOT reach
  // headers() in the admin layout on hosted runtimes such as Netlify's
  // OpenNext runtime: the layout then sees an empty path and redirects
  // /admin/login to itself, leaving an empty <main> on the live site
  // (verified 2026-10-30: local Next server propagated the response
  // header, Netlify did not). Request headers are the documented way
  // to hand data from middleware to server components.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-admin-path', pathname);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  if (pathname === '/admin/login') {
    return next();
  }
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  const hasDemo = req.cookies.get('ai-portfolio-demo-admin')?.value === '1';
  const hasSupabaseSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (hasDemo || hasSupabaseSession) {
    return next();
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  return NextResponse.redirect(url);
}

// '/admin' itself is listed explicitly: '/admin/:path*' alone is easy to
// misread as covering the bare path, and the layout guard must never
// depend on this matcher being the only protection (see layout.tsx).
export const config = { matcher: ['/admin', '/admin/:path*'] };
