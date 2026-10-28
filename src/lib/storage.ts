import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// =============================================================
// خدمة التخزين السحابي للملفات — Cloudflare R2 (متوافق S3)
// - عند توفر متغيرات R2: الملفات تُرفع للسحابة وتُخزن قاعدة البيانات المرجع فقط
// - بدون R2: يُستخدم الوضع القديم (محتوى الملف داخل قاعدة البيانات) للحفاظ على النظام الشغال
// الأمان: المفاتيح السرية على السيرفر فقط، والتحميل يمر عبر API مصادق عليه
// =============================================================

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (حد المنصة الفعلي للرفع 4.5MB — الضغط يتم في المتصفح)
export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export function generateFileId(): string {
  return crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');
}

export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.slice(0, 3).toString() === 'GIF') return 'image/gif';
  if (buffer.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  return null;
}

// --- إعداد R2 ---
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;

export function r2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!r2Configured()) throw new Error('التخزين السحابي غير مهيأ');
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

// مفتاح الكائن: uploads/YYYY/MM/<fileId>-<filename الأساسي>
export function buildStorageKey(fileId: string, originalName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase().slice(0, 10) : '';
  const safeExt = /^[a-z0-9.]+$/.test(ext) ? ext : '';
  return `uploads/${yyyy}/${mm}/${fileId}${safeExt}`;
}

/** رفع الملف للتخزين السحابي مع التحقق من قبول المزود */
export async function uploadToStorage(buffer: Buffer, key: string, mimeType: string): Promise<void> {
  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  // التحقق من قبول الملف فعلياً (HeadObject — استعلام خفيف بدون تحميل المحتوى)
  const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
  if (!head.ContentLength || head.ContentLength !== buffer.length) {
    throw new Error('فشل التحقق من رفع الملف إلى التخزين السحابي');
  }
}

/** تحميل الملف من التخزين السحابي */
export async function downloadFromStorage(key: string): Promise<Buffer | null> {
  if (!r2Configured()) return null;
  try {
    const client = getS3Client();
    const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

/** حذف الملف من التخزين السحابي (لا يُرمى الخطأ حتى لا يمنع حذف السجل) */
export async function deleteFromStorage(key: string): Promise<void> {
  if (!r2Configured()) return;
  try {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
  } catch {}
}

/** حذف يتيم: يُستدعى إذا فشلت قاعدة البيانات بعد رفع ناجح */
export async function cleanupOrphan(key: string): Promise<void> {
  await deleteFromStorage(key);
}
