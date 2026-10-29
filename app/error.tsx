'use client';
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">页面加载失败</h1>
      <p className="text-muted2">请检查网络或稍后再试，也可以重新加载本页。</p>
      <button onClick={reset} className="min-h-[44px] rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black">重试</button>
    </div>
  );
}
