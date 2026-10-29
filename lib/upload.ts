export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Extension (lower-cased, without the dot) -> the ONE MIME type it may claim. */
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

function fileExtension(name: string): string | null {
  const base = name.split('/').pop() ?? '';
  const i = base.lastIndexOf('.');
  if (i <= 0) return null; // no extension, or a dotfile such as ".png"
  return base.slice(i + 1).toLowerCase();
}

/**
 * Sniff the real image type from magic bytes. Never trust the
 * client-supplied MIME type or extension alone: both are attacker
 * controlled in a multipart upload (curl can claim anything).
 * Returns the validated MIME type, or null for unknown / dangerous
 * content (SVG and HTML have no entry here on purpose — an SVG is
 * active content, and text/html must never be stored as an "image").
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  ) {
    return 'image/webp';
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 && // "ftyp"
    bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66 // "avif"
  ) {
    return 'image/avif';
  }
  return null;
}

/**
 * Full upload validation. Checks, in order: size, claimed MIME is in the
 * allowlist, extension exists and matches the claimed MIME, and magic
 * bytes match BOTH. Returns { ok: true, mime } with the VALIDATED mime
 * (callers must use this for the Storage contentType, never file.type),
 * or { ok: false, message }.
 */
export function validateUploadedImage(file: {
  type: string;
  size: number;
  name: string;
  bytes: Uint8Array;
}): { ok: true; mime: string } | { ok: false; message: string } {
  if (file.size <= 0) return { ok: false, message: '文件为空，请重新选择' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: '图片超过 5MB 上限，请压缩后重试' };
  const claimed = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(claimed)) {
    return { ok: false, message: '只接受 JPEG、PNG、WebP、GIF、AVIF 格式的图片' };
  }
  const ext = fileExtension(file.name);
  if (!ext || EXTENSION_TO_MIME[ext] !== claimed) {
    return { ok: false, message: '文件扩展名与图片格式不一致，请检查文件' };
  }
  const sniffed = sniffImageType(file.bytes);
  if (!sniffed) {
    return { ok: false, message: '文件内容不是有效的图片格式（SVG 与 HTML 文件不接受）' };
  }
  if (sniffed !== claimed) {
    return { ok: false, message: '文件内容与声明的图片格式不一致，请检查文件' };
  }
  return { ok: true, mime: sniffed };
}

/**
 * Legacy metadata-only check (kept for callers that have no bytes yet).
 * It validates MIME + size + extension match, but it is NOT sufficient
 * on its own — the upload route and upload action always run
 * validateUploadedImage() on the real bytes before writing anything.
 */
export function validateImageFile(file: { type: string; size: number; name: string }): string | null {
  if (file.size <= 0) return '文件为空，请重新选择';
  if (file.size > MAX_IMAGE_BYTES) return '图片超过 5MB 上限，请压缩后重试';
  const claimed = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(claimed)) {
    return '只接受 JPEG、PNG、WebP、GIF、AVIF 格式的图片';
  }
  const ext = fileExtension(file.name);
  if (!ext || EXTENSION_TO_MIME[ext] !== claimed) {
    return '文件扩展名与图片格式不一致，请检查文件';
  }
  return null;
}

export function uniqueFileName(originalName: string): string {
  // Strip path separators and control chars, collapse ".." runs (never a
  // traversal: the name is always used as a single path segment), drop
  // leading dots so ".png" cannot become a hidden file.
  const safe =
    originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+/, '') || 'image';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}-${safe}`;
}

/** Extract the storage object path from a Supabase public URL, or null. */
export function supabaseObjectPath(publicUrl: string): string | null {
  const marker = '/portfolio-images/';
  const i = publicUrl.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(publicUrl.slice(i + marker.length).split('?')[0]);
}

/** Local demo upload path (e.g. "/uploads/abc.png") -> file name, or null. */
export function localUploadName(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const name = url.slice('/uploads/'.length);
  return name && !name.includes('/') ? name : null;
}
