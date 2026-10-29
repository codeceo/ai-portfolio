'use client';

export default function ConfirmDialog({
  open, title, message, confirmLabel = '确认', cancelLabel = '取消', busy = false,
  onConfirm, onCancel,
}: {
  open: boolean; title: string; message: React.ReactNode;
  confirmLabel?: string; cancelLabel?: string; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="glass w-full max-w-md rounded-2xl p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 text-sm leading-relaxed text-muted2">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="min-h-[40px] rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50">
            {cancelLabel}
          </button>
          <button disabled={busy} onClick={onConfirm} className="min-h-[40px] rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
