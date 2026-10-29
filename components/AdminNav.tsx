import Link from 'next/link';
import { logoutAction } from '@/lib/admin-actions';
export default function AdminNav() {
  return (
    <nav className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm">
      <Link href="/admin" className="font-semibold">仪表盘</Link>
      <Link href="/admin/works" className="rounded-full px-3 py-1 hover:bg-white/10">作品管理</Link>
      <Link href="/admin/works/new" className="rounded-full px-3 py-1 hover:bg-white/10">新建作品</Link>
      <Link href="/admin/categories" className="rounded-full px-3 py-1 hover:bg-white/10">分类管理</Link>
      <span className="flex-1" />
      <form action={logoutAction}><button className="rounded-full bg-white/10 px-3 py-1">退出登录</button></form>
    </nav>
  );
}
