export function cn(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(' '); }
export function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return iso; }
}
export function statusLabel(s: string) { return s === 'published' ? '已发布' : s === 'archived' ? '已下架' : '草稿'; }
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
