// Security + archive-flow checks, DEMO mode only (no live Supabase).
//   node --import ./scripts/acceptance-loader.mjs scripts/security-check.mts
// Covers what the HTTP acceptance harness cannot: zod URL validation,
// magic-byte upload sniffing, archive visibility across every public
// query path (list / search / tag / category / related / tags list),
// republish published_at stability, reference-checked cleanup, the
// category-delete block helper, and repo secret hygiene.
// Test works are deleted and data/*.json are restored afterwards.
// Supabase live verification is NOT done here (no credentials exist).
import { demoRepo } from '../lib/data/demo-repo.ts';
import { workSchema } from '../lib/validation.ts';
import { isSafeHttpUrl, isSafeImageUrl } from '../lib/safe-url.ts';
import {
  sniffImageType, validateUploadedImage, uniqueFileName, localUploadName,
} from '../lib/upload.ts';
import {
  applyPublishedAt, planCleanup, worksReferencingCategory,
} from '../lib/work-rules.ts';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const results: Array<{ step: string; ok: boolean; detail: string }> = [];
const check = (step: string, ok: boolean, detail = '') => {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${step}] ${detail}`);
};
const worksFile = path.join(ROOT, 'data', 'works.json');
const catsFile = path.join(ROOT, 'data', 'categories.json');
const worksBackup = fs.existsSync(worksFile) ? fs.readFileSync(worksFile) : null;
const catsBackup = fs.existsSync(catsFile) ? fs.readFileSync(catsFile) : null;

const baseValues = {
  slug: 'security-check-work', title: '安检测试作品', summary: '仅用于安检测试，结束后删除。',
  description: '安检描述', category: 'web', tags: ['安检唯一标签'],
  cover_image_url: null, gallery_images: [], highlights: [],
  demo_url: null, repo_url: null, source_url: null, external_links: [],
  status: 'draft' as const, featured: false, sort_order: 997,
  started_at: null, seo_title: null, seo_description: null, og_image_url: null,
};
const valid = (over: Record<string, unknown>) => workSchema.safeParse({ ...baseValues, ...over }).success;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const AVIF = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
const HTML = new Uint8Array(Buffer.from('<html><script>alert(1)</script></html>'));

async function main() {
  // 1) Dangerous URLs rejected by validation AND by render-time helpers.
  check('url-javascript-rejected', !valid({ demo_url: 'javascript:alert(1)' }) && !valid({ source_url: 'JaVaScRiPt:alert(1)' }) && !isSafeHttpUrl('javascript:alert(1)'));
  check('url-data-rejected', !valid({ demo_url: 'data:text/html,<script>alert(1)</script>' }) && !valid({ external_links: [{ label: 'x', url: 'data:text/html;base64,xxx' }] }) && !isSafeHttpUrl('data:text/html,x'));
  check('url-https-accepted', valid({ demo_url: 'https://example.com/demo', source_url: 'https://github.com/example/repo' }));
  check('url-cover-rules', !valid({ cover_image_url: 'javascript:alert(1)' }) && !valid({ cover_image_url: 'data:image/png;base64,xxx' }) && !valid({ cover_image_url: '//evil.example/x.png' }) && valid({ cover_image_url: '/uploads/a.png' }) && valid({ cover_image_url: 'https://example.com/c.png' }) && !isSafeImageUrl('//evil.example/x.png'));
  check('url-og-gallery-rules', !valid({ og_image_url: 'javascript:alert(1)' }) && !valid({ gallery_images: ['data:text/html,x'] }));

  // 2) Upload sniffing: magic bytes must match claimed MIME + extension.
  const up = (type: string, name: string, bytes: Uint8Array, size = bytes.length) =>
    validateUploadedImage({ type, size, name, bytes });
  check('upload-png-ok', up('image/png', 'a.png', PNG).ok === true);
  check('upload-jpeg-gif-webp-avif-ok', up('image/jpeg', 'a.jpg', JPEG).ok === true && up('image/gif', 'a.gif', GIF).ok === true && up('image/webp', 'a.webp', WEBP).ok === true && up('image/avif', 'a.avif', AVIF).ok === true);
  check('upload-html-as-png-rejected', up('image/png', 'evil.png', HTML).ok === false);
  check('upload-png-bytes-as-jpeg-rejected', up('image/jpeg', 'a.jpg', PNG).ok === false);
  check('upload-extension-mismatch-rejected', up('image/png', 'a.jpg', PNG).ok === false && up('image/jpeg', 'a.png', JPEG).ok === false);
  check('upload-svg-rejected', up('image/svg+xml', 'a.svg', new Uint8Array(Buffer.from('<svg/>'))).ok === false);
  check('upload-oversize-rejected', up('image/png', 'a.png', PNG, 5 * 1024 * 1024 + 1).ok === false);
  check('upload-sniff-fns', sniffImageType(PNG) === 'image/png' && sniffImageType(HTML) === null);
  const trav = uniqueFileName('../../etc/passwd.png');
  check('upload-no-traversal', !trav.includes('/') && !trav.startsWith('.') && trav.endsWith('.png'));
  check('upload-local-name-guard', localUploadName('/uploads/a/b.png') === null && localUploadName('/uploads/a.png') === 'a.png');

  // 3) Archive / republish flow across EVERY public query path.
  const SLUG = 'security-check-work';
  const all0 = await demoRepo.listAll();
  if (all0.some((w) => w.slug === SLUG)) await demoRepo.remove(all0.find((w) => w.slug === SLUG)!.id);
  const created = await demoRepo.create({ ...baseValues, published_at: null });
  const pub = async (opts: Parameters<typeof demoRepo.listPublished>[0]) =>
    (await demoRepo.listPublished(opts)).some((w) => w.slug === SLUG);
  const paged = async (opts: Parameters<typeof demoRepo.listPublishedPaged>[0]) =>
    (await demoRepo.listPublishedPaged(opts)).works.some((w) => w.slug === SLUG);
  check('archive-draft-invisible', !(await pub({})) && !(await paged({ page: 1, pageSize: 9 })) && !(await pub({ q: '安检唯一' })) && !(await pub({ tag: '安检唯一标签' })));
  const firstAt = applyPublishedAt(created, { status: 'published' }, new Date().toISOString());
  await demoRepo.update(created.id, { status: 'published', published_at: firstAt });
  check('archive-published-visible', (await pub({})) && (await pub({ q: '安检唯一' })) && (await pub({ tag: '安检唯一标签' })) && (await pub({ category: 'web' })) && (await demoRepo.listTags()).includes('安检唯一标签'));
  const relatedVisible = (await demoRepo.listPublished({ category: 'web' })).filter((w) => w.id !== created.id);
  check('archive-related-source-is-published-only', relatedVisible.every((w) => w.status === 'published'));
  await demoRepo.update(created.id, { status: 'archived', featured: false });
  const after = await demoRepo.getById(created.id);
  check('archive-archived-invisible-everywhere',
    !(await pub({})) && !(await pub({ q: '安检唯一' })) && !(await pub({ tag: '安检唯一标签' })) &&
    !(await pub({ category: 'web' })) && !(await paged({ q: '安检唯一', page: 1, pageSize: 9 })) &&
    !(await demoRepo.listTags()).includes('安检唯一标签') &&
    (await demoRepo.listPublished({ category: 'web' })).every((w) => w.slug !== SLUG));
  check('archive-record-and-history-kept', after !== null && after.status === 'archived' && after.published_at === firstAt);
  const repubAt = applyPublishedAt(after, { status: 'published' }, new Date().toISOString());
  await demoRepo.update(created.id, { status: 'published', published_at: repubAt });
  const repub = await demoRepo.getById(created.id);
  check('archive-republish-restores-and-keeps-published-at', repub?.status === 'published' && repub.published_at === firstAt && (await pub({})));

  // 4) Delete cleanup + category block helper.
  await demoRepo.update(created.id, { cover_image_url: '/uploads/shared-test.png', og_image_url: '/uploads/og-test.png' });
  const sharer = await demoRepo.create({
    ...baseValues, slug: 'security-check-sharer', title: '安检共享作品', tags: [],
    cover_image_url: '/uploads/shared-test.png', published_at: null,
  });
  const plan1 = planCleanup(await demoRepo.listAll(), created.id);
  check('delete-shared-file-kept', plan1.kept.includes('/uploads/shared-test.png') && plan1.toDelete.includes('/uploads/og-test.png'));
  await demoRepo.remove(created.id);
  await demoRepo.remove(sharer.id);
  const remaining = await demoRepo.listAll();
  const stillRef = remaining.some((w) => [w.cover_image_url, ...(w.gallery_images ?? []), w.og_image_url].includes('/uploads/shared-test.png'));
  check('delete-no-work-references-shared-file', !stillRef);
  check('category-block-helper', worksReferencingCategory(await demoRepo.listAll(), 'web').length > 0 && worksReferencingCategory(await demoRepo.listAll(), 'no-such-category').length === 0);

  // 5) Repo hygiene + migration files.
  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf-8');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8');
  check('secrets-no-service-role-placeholder', !envExample.includes('SERVICE_ROLE_KEY=') && !fs.existsSync(path.join(ROOT, '.env')) && !fs.existsSync(path.join(ROOT, '.env.local')));
  check('secrets-gitignore', gitignore.includes('.env') && gitignore.includes('.env*.local'));
  const m001 = fs.readFileSync(path.join(ROOT, 'supabase/migrations/001_init.sql'), 'utf-8');
  const m003 = fs.readFileSync(path.join(ROOT, 'supabase/migrations/003_admin_and_fields.sql'), 'utf-8');
  const m004 = fs.readFileSync(path.join(ROOT, 'supabase/migrations/004_indexes_and_checks.sql'), 'utf-8');
  check('migrations-001-003-004',
    m001.includes("check (status in ('draft','published','archived'))") &&
    m001.includes("unique") &&
    m003.includes('drop policy if exists "admin write works"') &&
    m003.includes('admin allowlist write works') &&
    m001.includes('public read published works') && // published-only read lives in 001; 003 leaves it untouched
    m003.includes('admins self read') &&
    m004.includes('using gin (tags)') &&
    m004.includes("where status = 'published' and featured = true") &&
    m004.includes('idx_works_status_sort_order'));
}

try {
  await main();
} finally {
  // Always clean up test data, even on failure.
  try {
    const all = await demoRepo.listAll();
    for (const w of all.filter((x) => x.slug.startsWith('security-check-'))) await demoRepo.remove(w.id);
  } catch { /* restore below covers it */ }
  if (worksBackup !== null) fs.writeFileSync(worksFile, worksBackup);
  if (catsBackup !== null) fs.writeFileSync(catsFile, catsBackup);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} security checks passed`);
if (failed.length) { console.log('FAILED:', failed.map((f) => f.step).join(', ')); process.exit(1); }
