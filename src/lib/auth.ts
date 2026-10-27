import crypto from 'crypto';
import { db } from './db';

const SESSION_HOURS = 12;

export const ROLES: Record<string, string> = {
  admin: 'مدير',
  manager: 'مدير فرعي',
  accountant: 'محاسب',
  collector: 'محصّل',
  viewer: 'مشاهد',
};

export function canWrite(role: string, entity: string): boolean {
  if (role === 'admin' || role === 'manager') return true;
  // المحاسب: يستطيع التعديل في الأقسام المالية فقط (عقود، مدفوعات، إيرادات، مصروفات، قروض، حسابات، قيود)
  if (role === 'accountant') return ['contracts', 'payments', 'transactions', 'loans', 'loanPayments', 'accounts', 'journal', 'files'].includes(entity);
  // المحصّل: يستطيع تسجيل المدفوعات والصيانة فقط
  if (role === 'collector') return ['payments', 'maintenance', 'files'].includes(entity);
  // المشاهد: قراءة فقط
  return false;
}

export function canRead(role: string, entity: string): boolean {
  if (entity === 'users' && role !== 'admin' && role !== 'manager') return false;
  if (entity === 'restore' && role !== 'admin' && role !== 'manager') return false;
  if (entity === 'audit' && role !== 'admin' && role !== 'manager') return false;
  return true;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (computed.length !== stored.length) return false;
  return crypto.timingSafeEqual(computed, stored);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await db.session.create({
    data: { token, userId, expiresAt },
  });
  return token;
}

export async function getSession(token: string) {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await db.session.delete({ where: { id: session.id } });
    return null;
  }
  if (!session.user.active) return null;
  // Refresh session if halfway expired
  const halfExpiry = new Date(session.expiresAt.getTime() - SESSION_HOURS * 1800 * 1000);
  if (new Date() > halfExpiry) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000) },
    });
  }
  return session.user;
}

export async function deleteSession(token: string): Promise<void> {
  try { await db.session.deleteMany({ where: { token } }); } catch {}
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = /(?:^|;\s*)sid=([^;]+)/.exec(cookie);
  return match ? match[1] : null;
}

export async function authMiddleware(request: Request) {
  // Check cookie first, then Authorization header
  let token = getSessionToken(request);
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
  if (!token) throw new Error('غير مصرح');
  const user = await getSession(token);
  if (!user) throw new Error('غير مصرح');
  return user;
}

export function sessionCookie(token: string, maxAge: number = SESSION_HOURS * 3600): string {
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// Rate limiter
const failMap = new Map<string, { count: number; until: number }>();

export function isLocked(key: string): boolean {
  const entry = failMap.get(key);
  if (!entry) return false;
  if (entry.until > Date.now()) return true;
  failMap.delete(key);
  return false;
}

export function recordFail(key: string): void {
  const entry = failMap.get(key) || { count: 0, until: 0 };
  entry.count++;
  if (entry.count >= 5) {
    entry.until = Date.now() + 10 * 60 * 1000;
    entry.count = 0;
  }
  failMap.set(key, entry);
}

export function clearFails(key: string): void {
  failMap.delete(key);
}
