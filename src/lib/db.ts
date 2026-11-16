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
