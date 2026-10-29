import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getMode } from '@/lib/data/repository';
import { site, siteUrl } from '@/lib/site';

const base = siteUrl();
export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: `${site.brand} — 个人 AI 产品作品集`, template: `%s | ${site.brand}` },
  description: site.description,
  alternates: { canonical: base },
  openGraph: {
    title: `${site.brand} — 个人 AI 产品作品集`,
    description: site.description,
    url: base,
    siteName: site.brand,
    locale: 'zh_CN',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = getMode();
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint; default is dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ai-lab-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div className="ambient" aria-hidden />
        {/* mt-[68px] pushes the banner below the fixed header pill (12px top
            padding + 56px pill height); without it the pill covered the banner. */}
        {mode === 'demo' && <div className="mt-[68px] bg-amber-400/15 px-4 py-2 text-center text-xs text-amber-200">演示模式：未配置 Supabase，数据保存在本地 data/works.json，刷新后仍保留。生产请按 README 配置 Supabase。</div>}
        <Header />
        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-8 pt-24 sm:px-6 sm:pt-28">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
