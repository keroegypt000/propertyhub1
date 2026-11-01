// =============================================================
// مسح البيانات التجريبية — تهيئة النظام للعمل الحقيقي
// ⚠️ للمدير (admin) فقط — المدير الفرعي والمحاسب والمحصل لا يرون الزر ولا يصلون للـ API
// الأمان:
//   1) قبل المسح تُنشأ نقطة استعادة كاملة تلقائيًا (يمكن الرجوع بها من صفحة نقاط الاستعادة)
//   2) يتطلب تأكيدًا كتابيًا في الواجهة + كلمة تأكيد في الطلب
// ما يُمسح: القيود، أقساط القروض، القروض، المدفوعات، العقود، الملفات (مراجعها)،
//           الصيانة، الحركات المالية، الوحدات، المستأجرين، العمارات، شجرة الحسابات
// ما يُحتفظ به: حسابات المستخدمين، الجلسات، سجل التدقيق، نقاط الاستعادة
// ملاحظة: شجرة الحسابات تُعاد تلقائيًا عند أول عملية محاسبية (ensureAccounts)
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const CONFIRM_PHRASE = 'مسح البيانات التجريبية';

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    // صلاحية صارمة: المدير الرئيسي فقط
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'هذه العملية للمدير الرئيسي فقط' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if ((body?.confirm || '').trim() !== CONFIRM_PHRASE) {
      return NextResponse.json({ error: 'عبارة التأكيد غير صحيحة' }, { status: 400 });
    }

    // 1) نقطة استعادة تلقائية قبل المسح — شبكة أمان كاملة
    const [buildings, units, tenants, contracts, payments, maintenance, files, transactions, loans, loanPayments, accounts, journalEntries] = await Promise.all([
      db.building.findMany(),
      db.unit.findMany(),
      db.tenant.findMany(),
      db.contract.findMany(),
      db.payment.findMany(),
      db.maintenanceRequest.findMany(),
      db.fileUpload.findMany({
        select: {
          id: true, filename: true, originalName: true, mimeType: true, size: true,
          category: true, contractId: true, maintenanceId: true, tenantId: true,
          uploadedBy: true, createdAt: true,
        },
      }),
      db.transaction.findMany(),
      db.loan.findMany(),
      db.loanPayment.findMany(),
      db.account.findMany(),
      db.journalEntry.findMany(),
    ]);

    const snapshot = JSON.stringify({ buildings, units, tenants, contracts, payments, maintenance, files, transactions, loans, loanPayments, accounts, journalEntries });
    const point = await db.restorePoint.create({
      data: {
        name: `نسخة أمان قبل مسح البيانات التجريبية — ${new Date().toLocaleString('ar')}`,
        description: 'أُنشئت تلقائيًا قبل مسح البيانات التجريبية. استعدها من صفحة نقاط الاستعادة إن أردت التراجع.',
        snapshot,
        createdBy: user.id,
      },
    });

    // 2) المسح بترتيب يحترم العلاقات (الأبناء قبل الآباء)
    const [delJournal, delLoanPayments, delLoans, delPayments, delFiles, delContracts, delMaintenance, delTransactions, delUnits, delTenants, delBuildings, delAccounts] = await db.$transaction([
      db.journalEntry.deleteMany({}),
      db.loanPayment.deleteMany({}),
      db.loan.deleteMany({}),
      db.payment.deleteMany({}),
      db.fileUpload.deleteMany({}),
      db.contract.deleteMany({}),
      db.maintenanceRequest.deleteMany({}),
      db.transaction.deleteMany({}),
      db.unit.deleteMany({}),
      db.tenant.deleteMany({}),
      db.building.deleteMany({}),
      db.account.deleteMany({}),
    ]);

    const counts = {
      journalEntries: delJournal.count,
      loanPayments: delLoanPayments.count,
      loans: delLoans.count,
      payments: delPayments.count,
      files: delFiles.count,
      contracts: delContracts.count,
      maintenance: delMaintenance.count,
      transactions: delTransactions.count,
      units: delUnits.count,
      tenants: delTenants.count,
      buildings: delBuildings.count,
      accounts: delAccounts.count,
    };

    await logAudit(user.id, 'delete', 'system', point.id, counts, 'مسح جميع البيانات التجريبية وتهيئة النظام للعمل الحقيقي (مع نسخة أمان تلقائية)');

    return NextResponse.json({ ok: true, restorePointId: point.id, counts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في مسح البيانات' }, { status: 400 });
  }
}
