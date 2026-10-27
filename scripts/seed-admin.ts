import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

async function main() {
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin123';
  const ADMIN_NAME = 'مدير النظام';

  const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });

  if (existing) {
    const { hash, salt } = hashPassword(ADMIN_PASSWORD);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, salt, role: 'admin', active: true },
    });
    console.log(`✅ تم تحديث باسورد الادمن: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  } else {
    const { hash, salt } = hashPassword(ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        name: ADMIN_NAME,
        passwordHash: hash,
        salt,
        role: 'admin',
        active: true,
      },
    });
    console.log(`✅ تم إنشاء حساب الادمن: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  }
}

main()
  .catch((e) => { console.error('❌ خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
