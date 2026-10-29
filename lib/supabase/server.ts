import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function createServerSupabase() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) { try { cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options as never)); } catch { /* called from Server Component */ } }
    }
  });
}
