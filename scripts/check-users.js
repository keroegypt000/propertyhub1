// فحص مستخدمي قاعدة البيانات المحلية (لأغراض الاختبار فقط)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { username: true, role: true } })
  .then(u => console.log(JSON.stringify(u)))
  .catch(e => console.error('ERR:', e.message))
  .finally(() => p.$disconnect());
