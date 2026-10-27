import crypto from 'crypto';

// تخزين الملفات يتم الآن داخل قاعدة البيانات (FileUpload.data)
// هذا يجعل الرفع يعمل على أي منصة سحابية (Vercel serverless) بدون قرص محلي دائم

export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.slice(0, 3).toString() === 'GIF') return 'image/gif';
  if (buffer.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  return null;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export function generateFileId(): string {
  return crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');
}
