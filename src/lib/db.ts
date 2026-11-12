import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

// نخزّن النسخة دائمًا (حتى في الإنتاج) — كل دالة serverless على Vercel
// تعيد استخدام نفس عميل Prisma بدل فتح اتصالات جديدة كل مرة
globalForPrisma.prisma = db
