// فحص حالة قاعدة البيانات المحلية للاختبار
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  const contracts = await db.contract.findMany({
    include: { tenant: { select: { name: true, tenantType: true } }, unit: { select: { number: true } } },
  });
  console.log('=== العقود ===');
  contracts.forEach((c) =>
    console.log('عقد:', c.unit?.number, '|', c.tenant?.name, `(${c.tenant?.tenantType})`, '| إيجار', c.rentAmount, '|', String(c.startDate).slice(0, 10), '→', String(c.endDate).slice(0, 10), '|', c.status)
  );

  const entries = await db.journalEntry.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('=== قيود اليومية (' + entries.length + ') ===');
  entries.forEach((e) => {
    let lines = [];
    try { lines = JSON.parse(e.lines || '[]'); } catch {}
    console.log('  قيد [' + e.source + ']:', (e.description || '').slice(0, 80));
    lines.forEach((l) => console.log('     ', l.accountCode, l.accountName, l.debit > 0 ? 'مدين ' + l.debit : 'دائن ' + l.credit));
  });

  console.log('=== إحصاء ===');
  console.log('دفعات:', await db.payment.count(), '| حركات:', await db.transaction.count(), '| صيانة:', await db.maintenanceRequest.count(), '| قضايا:', await db.legalCase.count(), '| مستندات:', await db.fileUpload.count());
  const txs = await db.transaction.findMany({ orderBy: { createdAt: 'asc' } });
  txs.forEach((t) => console.log('  حركة:', t.date, t.type, t.category, t.amount, t.buildingId ? '(عمارة)' : '(عام)', t.notes ? '- ' + String(t.notes).slice(0, 40) : ''));
  await db.$disconnect();
})();
