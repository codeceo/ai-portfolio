'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCategoryAction } from '@/lib/admin-actions';
export default function CategoryRowActions({ id }: { id: string }) {
  const router = useRouter(); const [, start] = useTransition(); const [msg, setMsg] = useState('');
  return <span className="flex items-center gap-2"><button className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-200" onClick={() => { if (confirm('确定删除这个分类吗？如果已有作品引用该分类，删除会被阻止（需先为这些作品更换分类）。')) start(async () => { try { await deleteCategoryAction(id); router.refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : '删除失败'); } }); }}>删除</button>{msg && <span className="text-xs">{msg}</span>}</span>;
}
