import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const UPLOAD_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'data', 'uploads');

export function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function saveFile(buffer: Buffer, id: string): string {
  ensureUploadDir();
  const filePath = path.join(UPLOAD_DIR, id);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function readFile(id: string): Buffer | null {
  ensureUploadDir();
  const filePath = path.join(UPLOAD_DIR, id);
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export function deleteFile(id: string): void {
  const filePath = path.join(UPLOAD_DIR, id);
  try { fs.unlinkSync(filePath); } catch {}
}

export function getFilePath(id: string): string {
  return path.join(UPLOAD_DIR, id);
}

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
