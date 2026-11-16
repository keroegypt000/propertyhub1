import { PrismaClient } from '@prisma/client'

/**
 * حدود تجمع الاتصالات لكل نسخة serverless — تُضاف تلقائيًا لرابط Postgres
 * إذا لم تكن موجودة في DATABASE_URL. تعالج خطأ «too many connections» في
 * Supabase/Vercel من الكود مباشرة (روابط SQLite file: لا تتأثر).
 */
function withPoolLimits(url: string | undefined): string | undefined {
  if (!url || url.startsWith('file:') || url.startsWith('file://')) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '5');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '15');
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '10');
    return u.toString();
  } catch { return url; }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: withPoolLimits(process.env.DATABASE_URL) } },
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

// نخزّن النسخة دائمًا (حتى في الإنتاج) — كل دالة serverless على Vercel
// تعيد استخدام نفس عميل Prisma بدل فتح اتصالات جديدة كل مرة
globalForPrisma.prisma = db

/**
 * أخطاء الاتصالات المؤقتة — ضغط اتصالات قاعدة البيانات في الإنتاج
 * (Supabase «too many connections» / انقطاع لحظي / تعارض معاملة)
 * هذه الأخطاء لا تعني فشل العملية نفسها — إعادة المحاولة بعد لحظات تنجح غالبًا.
 */
const TRANSIENT_DB_ERROR = /too many connections|timed out fetching|can't reach database|connection pool|connection terminated|connection closed|could not connect|P1001|P1002|P2024|P2034/i

export function isTransientDbError(error: any): boolean {
  const text = `${error?.message || ''} ${error?.code || ''}`;
  return TRANSIENT_DB_ERROR.test(text);
}

/** خطأ تحقق من البيانات — للتمييز بين رفض الطلب (400) وفشل قاعدة البيانات (500) */
export class ValidationError extends Error {}

/**
 * إعادة محاولة عملية قاعدة البيانات عند الأخطاء المؤقتة فقط.
 * الآمن على العمليات الذرية ($transaction) — فشل المعاملة يرجع كل شيء
 * فإعادة تشغيلها من الصفر لا تكرر شيئًا. أخطاء التحقق والأخطاء المنطقية
 * لا تُعاد — تُرمى فورًا.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts: number = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error instanceof ValidationError || !isTransientDbError(error) || i === attempts - 1) throw error;
      console.warn(`[db-retry] محاولة ${i + 1} فشلت بخطأ اتصال مؤقت — إعادة المحاولة: ${error?.message || error}`);
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw lastError;
}
