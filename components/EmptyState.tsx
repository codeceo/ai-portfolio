import { FolderOpen } from 'lucide-react';
export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><FolderOpen className="mx-auto text-muted2" size={28} /><p className="mt-3 font-medium">{title}</p>{hint && <p className="mt-1 text-sm text-muted2">{hint}</p>}</div>;
}
