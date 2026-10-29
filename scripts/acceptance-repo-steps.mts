// In-process acceptance steps using the REAL demo repository and the
// SAME shared rule/cleanup helpers the server actions call
// (lib/work-rules.ts, lib/upload.ts). Auth wrapping (requireAdmin) is
// verified separately over HTTP in scripts/acceptance-demo.mjs, because
// server actions need a Next request context that a plain node process
// does not have. Usage: node --import ./scripts/acceptance-loader.mjs
//   scripts/acceptance-repo-steps.mts <step> [args]
import { demoRepo } from '../lib/data/demo-repo.ts';
import { applyPublishedAt, featuredRuleError, planCleanup, slugTaken } from '../lib/work-rules.ts';
import { uniqueFileName, validateImageFile } from '../lib/upload.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

const SLUG = 'acceptance-test-work';
const step = process.argv[2];
const out = (o: unknown) => console.log(JSON.stringify(o));

async function find() {
  const all = await demoRepo.listAll();
  return { all, work: all.find((w) => w.slug === SLUG) ?? null };
}

if (step === 'create-draft') {
  const { all } = await find();
  if (all.some((w) => w.slug === SLUG)) { out({ ok: false, message: 'test work already exists' }); process.exit(0); }
  const created = await demoRepo.create({
    slug: SLUG, title: '验收测试作品', summary: '验收脚本创建的临时作品，测试结束会删除。',
    description: '仅用于验收测试。', category: 'web', tags: ['验收'],
    cover_image_url: null, gallery_images: [], highlights: [],
    demo_url: null, repo_url: null, source_url: null, external_links: [],
    status: 'draft', featured: false, sort_order: 999,
    published_at: null, started_at: null, seo_title: null, seo_description: null, og_image_url: null,
  });
  out({ ok: true, id: created.id, slug: created.slug, status: created.status, published_at: created.published_at });
} else if (step === 'set-cover') {
  const url = process.argv[3];
  const { work } = await find();
  if (!work) { out({ ok: false, message: 'not found' }); process.exit(0); }
  const saved = await demoRepo.update(work.id, { cover_image_url: url });
  out({ ok: true, cover_image_url: saved.cover_image_url });
} else if (step === 'publish') {
  const { work } = await find();
  if (!work) { out({ ok: false, message: 'not found' }); process.exit(0); }
  const published_at = applyPublishedAt(work, { status: 'published' }, new Date().toISOString());
  const saved = await demoRepo.update(work.id, { status: 'published', published_at });
  out({ ok: true, status: saved.status, published_at: saved.published_at, first_published_at: published_at });
} else if (step === 'archive') {
  const { work } = await find();
  if (!work) { out({ ok: false, message: 'not found' }); process.exit(0); }
  // Mirror applyStatus(): archiving clears featured in the same update.
  const saved = await demoRepo.update(work.id, { status: 'archived', featured: false });
  out({ ok: true, status: saved.status, featured: saved.featured, published_at: saved.published_at });
} else if (step === 'republish') {
  const { work } = await find();
  if (!work) { out({ ok: false, message: 'not found' }); process.exit(0); }
  const before = work.published_at;
  const published_at = applyPublishedAt(work, { status: 'published' }, new Date().toISOString());
  const saved = await demoRepo.update(work.id, { status: 'published', published_at });
  out({ ok: true, status: saved.status, published_at_before: before, published_at_after: saved.published_at, unchanged: before === saved.published_at });
} else if (step === 'rules') {
  const { all } = await find();
  out({
    featured_draft_rejected: featuredRuleError('draft', true) !== null,
    slug_taken: slugTaken(all, SLUG),
    upload_validation: validateImageFile({ type: 'text/plain', size: 10, name: 'x.txt' }),
    unique_names_differ: uniqueFileName('a.png') !== uniqueFileName('a.png'),
  });
} else if (step === 'delete') {
  const { all, work } = await find();
  if (!work) { out({ ok: false, message: 'not found' }); process.exit(0); }
  // Reference protection: a second work sharing the cover must keep the file.
  const cover = work.cover_image_url;
  const plan = planCleanup(all, work.id);
  let sharerId: string | null = null;
  if (cover) {
    const sharer = await demoRepo.create({
      slug: 'acceptance-sharer', title: '验收共享封面作品', summary: '共享封面，测试结束会删除。',
      description: null, category: 'web', tags: [], cover_image_url: cover, gallery_images: [],
      highlights: [], demo_url: null, repo_url: null, source_url: null, external_links: [],
      status: 'draft', featured: false, sort_order: 998,
      published_at: null, started_at: null, seo_title: null, seo_description: null, og_image_url: null,
    });
    sharerId = sharer.id;
    const all2 = await demoRepo.listAll();
    const plan2 = planCleanup(all2, work.id);
    const fileName = cover.startsWith('/uploads/') ? cover.slice('/uploads/'.length) : null;
    const filePath = fileName ? path.join(process.cwd(), 'public', 'uploads', fileName) : null;
    const existsBefore = filePath ? await fs.access(filePath).then(() => true).catch(() => false) : null;
    await demoRepo.remove(work.id);
    const existsAfterTargetDelete = filePath ? await fs.access(filePath).then(() => true).catch(() => false) : null;
    await demoRepo.remove(sharerId);
    // Now nothing references the file: the real delete path would remove it.
    // The helper only plans; perform the same guarded removal here.
    const remaining = await demoRepo.listAll();
    const stillReferenced = remaining.some((w) =>
      [w.cover_image_url, ...(w.gallery_images ?? []), w.og_image_url].includes(cover),
    );
    let existsAfterSharerDelete = existsAfterTargetDelete;
    if (filePath && !stillReferenced) {
      await fs.unlink(filePath).catch(() => {});
      existsAfterSharerDelete = await fs.access(filePath).then(() => true).catch(() => false);
    }
    out({
      ok: true, plan_before_sharer: plan, plan_with_sharer: plan2,
      file_exists_before: existsBefore, file_kept_after_target_delete: existsAfterTargetDelete,
      file_removed_after_sharer_delete: existsAfterSharerDelete === false,
    });
  } else {
    await demoRepo.remove(work.id);
    out({ ok: true, plan });
  }
} else {
  out({ ok: false, message: `unknown step: ${step}` });
  process.exit(1);
}
