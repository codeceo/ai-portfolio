'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Work } from '@/lib/types';
import { setStatusAction, deleteWorkAction, toggleFeaturedAction, setSortAction } from '@/lib/admin-actions';
import ConfirmDialog from './ConfirmDialog';

export default function AdminRowActions({ work }: { work: Work }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const run = (fn: () => Promise<unknown>, okMsg = '已更新') => start(async () => {
    try { await fn(); setMsg(okMsg); router.refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : '操作失败'); }
  });
  const btn = 'min-h-[40px] rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/works/${work.id}/edit`} className={btn}>编辑</Link>
      <a href={`/works/${work.slug}`} target="_blank" rel="noreferrer noopener" className={btn}>预览</a>
      {work.status !== 'published' && (
        <button className={btn} onClick={() => run(() => setStatusAction(work.id, 'published'))}>
          {work.status === 'archived' ? '重新上架' : '发布'}
        </button>
      )}
      {work.status === 'published' && (
        <button className={btn} onClick={() => run(() => setStatusAction(work.id, 'archived'))}>下架</button>
      )}
      <button className={btn} onClick={() => run(() => toggleFeaturedAction(work.id, !work.featured))}>
        {work.featured ? '取消精选' : '设为精选'}
      </button>
      <label className="flex items-center gap-1 text-xs">
        排序
        <input
          type="number" defaultValue={work.sort_order} aria-label={`排序值 ${work.title}`}
          onBlur={(e) => run(() => setSortAction(work.id, Number(e.target.value)))}
          className="min-h-[40px] w-16 rounded bg-black/40 px-1 py-2"
        />
      </label>
      <button
        className="min-h-[40px] rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-200 hover:bg-red-500/30"
        onClick={() => setConfirmDelete(true)}
      >
        删除
      </button>
      {msg && <span className="text-xs text-muted2">{msg}</span>}
      <ConfirmDialog
        open={confirmDelete}
        title="确认删除作品"
        message={<>
          <p>确定删除「{work.title}」吗？此操作会删除数据库记录，并清理仅被它引用的图片文件，不可撤销。</p>
          <p className="mt-2">下架不会删除记录；如果你只是想暂时隐藏它，请改用「下架」。</p>
        </>}
        confirmLabel="确认删除"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => start(async () => {
          setDeleting(true);
          try {
            const r = await deleteWorkAction(work.id);
            setMsg(r.message);
            setConfirmDelete(false);
            router.refresh();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : '删除失败');
            setConfirmDelete(false);
          } finally { setDeleting(false); }
        })}
      />
    </div>
  );
}
