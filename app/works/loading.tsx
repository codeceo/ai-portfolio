export default function WorksLoading() {
  return (
    <div className="space-y-6" aria-label="加载中">
      <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      <div className="glass h-40 rounded-2xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface overflow-hidden rounded-2xl">
            <div className="aspect-[16/9] animate-pulse bg-white/10" />
            <div className="space-y-2 p-5">
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-full animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
