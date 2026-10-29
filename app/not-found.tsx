import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-bold text-muted2">404</p>
      <h1 className="mt-4 text-2xl font-semibold">这个页面不存在</h1>
      <p className="mt-2 text-muted2">链接可能已失效，或作品已被下架。</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">回到首页</Link>
    </div>
  );
}
