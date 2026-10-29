// Single source of truth for brand, creator and contact info.
// Edit ONLY this file to change the brand name, intro, contact or social links.
export const site = {
  brand: 'AI LAB',
  name: 'AI LAB',
  tagline: '用 AI 将想法变成可以体验的产品。',
  description: '这里记录我用 AI 构建的工具、产品与创意实验。',
  heroTitle: 'Ideas, made tangible.',
  heroSubtitle: '用 AI 将想法变成可以体验的产品。',
  heroHelper: '这里记录我用 AI 构建的工具、产品与创意实验。',
  creatorIntro:
    '我持续用 AI 创作网站、效率工具、自动化工作流与视觉实验，并把值得留下的作品整理在这里。每一件作品都标注了类型与标签，点击作品可以查看介绍与体验链接。',
  creatorFocus: [
    'AI 生成的网站与 Web 应用',
    '提升日常效率的 AI 工具',
    '可复用的自动化工作流',
    'AI 视频、图像与视觉实验',
    '交互式实验项目',
  ],
  // Placeholder contact / social links — replace with real ones here.
  contactLabel: '联系我',
  contactEmail: 'hello@ai-lab.example',
  contactHref: '/about#contact',
  socials: [
    { label: 'GitHub', href: 'https://github.com/' },
    { label: 'X', href: 'https://x.com/' },
    { label: '邮箱', href: 'mailto:hello@ai-lab.example' },
  ],
  copyright: 'AI LAB',
};

export function siteUrl(): string {
  // Set NEXT_PUBLIC_SITE_URL in production (e.g. https://your-domain.vercel.app).
  // Fallback is only for local/demo metadata and sitemap generation.
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-lab.example';
}

export function categoryName(
  categories: { slug: string; name: string }[],
  slug: string,
): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}
