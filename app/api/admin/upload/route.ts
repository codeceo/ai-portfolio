import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getMode } from '@/lib/data/repository';
import { uniqueFileName, validateImageFile, validateUploadedImage } from '@/lib/upload';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Admin-only image upload. The client uploads via XMLHttpRequest so it
 * can show real upload progress. This route is NOT public: requireAdmin()
 * rejects unauthenticated callers (401) before any file is touched.
 * Validation is three-layered, in order, before anything is written:
 *   1. claimed MIME + size + extension match (validateImageFile),
 *   2. magic-byte sniff of the real bytes (validateUploadedImage) —
 *      SVG/HTML and MIME/extension/content mismatches are rejected,
 *   3. the Storage contentType is set from the VALIDATED mime, never
 *      from the client-claimed file.type.
 * Supabase mode -> portfolio-images bucket (unique name, no overwrite);
 * demo mode -> public/uploads/ (unique name, no overwrite).
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, message: '未登录或无管理员权限' }, { status: 401 });
  }
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ ok: false, message: '请选择图片文件' }, { status: 400 });
    }
    const metaErr = validateImageFile({ type: file.type, size: file.size, name: file.name });
    if (metaErr) return NextResponse.json({ ok: false, message: metaErr }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const checked = validateUploadedImage({
      type: file.type, size: file.size, name: file.name, bytes: new Uint8Array(buf),
    });
    if (!checked.ok) return NextResponse.json({ ok: false, message: checked.message }, { status: 400 });
    const name = uniqueFileName(file.name);
    if (getMode() === 'supabase') {
      const { createServerSupabase } = await import('@/lib/supabase/server');
      const sb = createServerSupabase();
      const { error } = await sb.storage.from('portfolio-images').upload(
        name, new File([buf], name, { type: checked.mime }),
        { upsert: false, contentType: checked.mime },
      );
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      const { data } = sb.storage.from('portfolio-images').getPublicUrl(name);
      return NextResponse.json({ ok: true, url: data.publicUrl });
    }
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buf);
    return NextResponse.json({ ok: true, url: `/uploads/${name}` });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : '上传失败' },
      { status: 500 },
    );
  }
}
