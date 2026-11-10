// ربط الوحدات المسجلة «مؤجرة» بدون عقود بمستأجرين وعقود نشطة
// المستأجر: اسم واضح «مستأجر وحدة X (عمارة Y)» مع ملاحظة أنه بيانات مؤقتة قابلة للتعديل
// العقد: سنة من اليوم، الإيجار = إيجار الوحدة الافتراضي، يوم الدفع 1
// Idempotent: يتخطى الوحدات التي لديها عقد نشط بالفعل والمستأجرين الموجودين بنفس الاسم
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const units = await db.unit.findMany({
    where: { status: 'rented', contracts: { none: { status: { in: ['active', 'renewed'] } } } },
    include: { building: true },
  });
  console.log('وحدات مؤجرة بدون عقد نشط:', units.length);

  let createdT = 0, createdC = 0;
  for (const u of units) {
    const name = `مستأجر وحدة ${u.number} (${u.building.name})`;
    let tenant = await db.tenant.findFirst({ where: { name } });
    if (!tenant) {
      tenant = await db.tenant.create({
        data: {
          name,
          tenantType: 'individual',
          notes: 'مستأجر أُنشئ تلقائيًا أثناء ربط الوحدات المستوردة — عدّل الاسم والبيانات الفعلية من «تعديل» أو باستيراد Excel',
        },
      });
      createdT++;
    }
    const start = new Date();
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    await db.contract.create({
      data: {
        unitId: u.id,
        tenantId: tenant.id,
        startDate: start,
        endDate: end,
        rentAmount: u.rentAmount || 0,
        discount: 0,
        deposit: 0,
        paymentDay: 1,
        status: 'active',
        notes: 'ربط تلقائي للوحدة المستوردة — عدّل التواريخ والإيجار الفعلية من تعديل العقد',
      },
    });
    createdC++;
    console.log(`✓ ${u.building.name} — وحدة ${u.number} → ${name} (إيجار ${u.rentAmount || 0})`);
  }
  console.log(`\nتم: ${createdT} مستأجر جديد، ${createdC} عقد جديد`);

  // تحقق نهائي
  const total = await db.unit.count({ where: { status: 'rented', contracts: { none: { status: { in: ['active', 'renewed'] } } } } });
  console.log('باقي وحدات مؤجرة بدون عقد نشط:', total);
}

main().finally(() => db.$disconnect());
