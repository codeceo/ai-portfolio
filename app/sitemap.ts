import type { MetadataRoute } from 'next';
import { getRepository } from '@/lib/data/repository';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const repo = await getRepository();
  const works = await repo.listPublished();
  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/works`, lastModified: new Date() },
    { url: `${base}/about`, lastModified: new Date() },
    ...works.map((w) => ({
      url: `${base}/works/${w.slug}`,
      lastModified: new Date(w.updated_at),
    })),
  ];
}
