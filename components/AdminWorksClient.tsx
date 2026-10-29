'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Category, Work } from '@/lib/types';
import { categoryName } from '@/lib/site';
import { formatDate, statusLabel } from '@/lib/utils';
import CoverImage from './CoverImage';
import AdminRowActions from './AdminRowActions';
import ConfirmDialog from './ConfirmDialog';
import { batchDeleteAction, batchStatusAction, type BatchResult } from '@/lib/admin-actions';

type Params = { q: string; status: string; category: string; sort: string };

export default function AdminWorksClient({
  works, categories, params, total,
}: {
  works: Work[]; categories: Category[]; params: Params; total: number;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | 'archive' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<(BatchResult & { cleanupFailed?: string[] }) | null>(null);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectedWorks = works.filter((w) => selected.has(w.id));

  const runBatch = () => start(async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const ids = selectedWorks.map((w) => w.id);
      const r = confirm === 'archive'
        ? await batchStatusAction(ids, 'archived')
        : await batchDeleteAction(ids);
      setBatchResult(r);
      setSelected(new Set());
      setConfirm(null);
      router.refresh();
    } finally { setBusy(false); }
  });

  const field = 'rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none';

  return (
    <div className="space-y-4">
      {/* Filters (GET form: filter state lives in the URL, shareable & server-filtered) */}
      <form method="get" action="/admin/works" className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="block text-sm">搜索标题
          <input name="q" defaultValue={params.q} placeholder="输入标题关键词" className={`${field} mt-1 block w-56`} />
        </label>
        <label className="block text-sm">状态
          <select name="status" defaultValue={params.status} className={`${field} mt-1 block`}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已下架</option>
          </select>
        </label>
        <label className="block text-sm">分类
          <select name="category" defaultValue={params.category} className={`${field} mt-1 block`}>
            <option value="">全部分类</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">排序
          <select name="sort" defaultValue={params.sort} className={`${field} mt-1 block`}>
            <option value="updated_desc">更新时间：最新在前</option>
            <option value="updated_asc">更新时间：最旧在前</option>
          </select>
        </label>
        <button className="min-h-[40px] rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">筛选</button>
        <Link href="/admin/works" className="min-h-[40px] rounded-xl border border-white/15 px-4 py-2 text-sm">清空筛选</Link>
        <span className="text-sm text-muted2">共 {total} 件（筛选后 {works.length} 件）</span>
      </form>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <span>已选 {selected.size} 件</span>
          <button onClick={() => setConfirm('archive')} className="min-h-[40px] rounded-xl bg-white/10 px-4 py-2">批量下架</button>
          <button onClick={() => setConfirm('delete')} className="min-h-[40px] rounded-xl bg-red-500/20 px-4 py-2 text-red-200">批量删除</button>
          <button onClick={() => setSelected(new Set())} className="text-muted2">取消选择</button>
        </div>
      )}

      {batchResult && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <p className="font-medium">批量操作完成</p>
          {batchResult.succeeded.length > 0 && <p className="mt-2 text-emerald-300">成功 {batchResult.succeeded.length} 件：{batchResult.succeeded.join('、')}</p>}
          {batchResult.failed.map((f) => (
            <p key={f.title} className="mt-1 text-red-300">失败：{f.title} — {f.reason}</p>
          ))}
          {(batchResult.cleanupFailed ?? []).length > 0 && (
            <p className="mt-1 text-amber-300">部分文件清理失败（记录已处理）：{(batchResult.cleanupFailed ?? []).join('；')}</p>
          )}
          {batchResult.failed.length === 0 && batchResult.succeeded.length === 0 && <p className="mt-1 text-muted2">没有可处理的有效项目。</p>}
        </div>
      )}

      {works.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-muted2">
          没有符合条件的作品。请换一个关键词、状态或分类，或<Link href="/admin/works" className="underline">清空筛选</Link>。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white/5 text-muted2">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox" aria-label="全选本页"
                    checked={works.length > 0 && works.every((w) => selected.has(w.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(works.map((w) => w.id)) : new Set())}
                  />
                </th>
                <th className="px-3 py-3">封面</th>
                <th className="px-3 py-3">标题</th>
                <th className="px-3 py-3">分类</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">精选</th>
                <th className="px-3 py-3">创建时间</th>
                <th className="px-3 py-3">更新时间</th>
                <th className="px-3 py-3">排序</th>
                <th className="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={`选择 ${w.title}`} checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative h-12 w-20 overflow-hidden rounded-lg border border-white/10">
                      <CoverImage src={w.cover_image_url} title={w.title} sizes="80px" />
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium">{w.title}</td>
                  <td className="px-3 py-3">{categoryName(categories, w.category)}</td>
                  <td className="px-3 py-3">{statusLabel(w.status)}</td>
                  <td className="px-3 py-3">{w.featured ? '是' : '否'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(w.created_at)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(w.updated_at)}</td>
                  <td className="px-3 py-3">{w.sort_order}</td>
                  <td className="px-3 py-3"><AdminRowActions work={w} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'archive' ? '确认批量下架' : '确认批量删除'}
        message={<>
          <p>
            将对以下 {selectedWorks.length} 件作品执行
            {confirm === 'archive' ? '批量下架（记录保留在后台，可重新上架）' : '批量删除（记录与仅被它们引用的图片将被删除，不可撤销）'}：
          </p>
          <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5">
            {selectedWorks.map((w) => <li key={w.id}>{w.title}</li>)}
          </ul>
          <p className="mt-2">每一件都会单独执行并上报成功/失败；部分失败不会静默当作全部成功。</p>
        </>}
        confirmLabel={confirm === 'archive' ? '确认批量下架' : '确认批量删除'}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runBatch}
      />
    </div>
  );
}
