import { site } from '@/lib/site';

export default function About() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">关于</h1>
      <p className="leading-relaxed text-muted2">{site.creatorIntro}</p>
      <p className="leading-relaxed text-muted2">每一件作品都标注了类型与标签，点击作品可以查看介绍与体验链接。作品由后台统一管理：新作品发布后会自动出现在这里，下架后则不再展示。</p>
      <div className="surface rounded-2xl p-5">
        <h2 className="font-semibold">我在做什么</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted2">
          {site.creatorFocus.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>
      <section id="contact" className="surface scroll-mt-28 rounded-2xl p-5">
        <h2 className="font-semibold">{site.contactLabel}</h2>
        <p className="mt-2 text-muted2">
          邮箱：<a href={`mailto:${site.contactEmail}`} className="text-lavender hover:underline">{site.contactEmail}</a>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {site.socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener" className="flex min-h-[40px] items-center rounded-full border border-white/15 px-4 text-sm hover:bg-white/10">
              {s.label}
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted2">个人资料、联系方式与社交链接统一配置在 lib/site.ts 中。</p>
      </section>
    </div>
  );
}
