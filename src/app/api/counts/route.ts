import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

// =============================================================
// GET /api/counts — عدد سجلات كل قسم في طلب واحد خفيف
// يغذي شارات العدد في القائمة الجانبية بحيث يرى المستخدم حجم بيانات
// كل صفحة قبل فتحها (ومنع اللبس: الرقم القديم جانب المجموعات كان عدد
// بنود المجموعة لا عدد السجلات).
// =============================================================

// عدد السندات المسجلة (قبض + صرف) من كل المصادر المولدة للسندات
async function countVouchers(): Promise<number> {
  const [receipts, tx, loans, loanPayments, maintenance, suppliers] = await Promise.all([
    db.payment.count({ where: { receiptNo: { not: null } } }),
    db.transaction.count({ where: { voucherNo: { not: null } } }),
    db.loan.count({ where: { receiptNo: { not: null } } }),
    db.loanPayment.count({ where: { paymentNo: { not: null } } }),
    db.maintenanceRequest.count({ where: { paymentNo: { not: null } } }),
    db.supplierPayment.count({ where: { paymentNo: { not: null } } }),
  ]);
  return receipts + tx + loans + loanPayments + maintenance + suppliers;
}

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const [buildings, units, maintenance, files, tenants, contracts, legalCases, payments, transactions, suppliers, loans, accounts, journal, users, audit, restore, vouchers] = await Promise.all([
      db.building.count(),
      db.unit.count(),
      db.maintenanceRequest.count(),
      db.fileUpload.count(),
      db.tenant.count(),
      db.contract.count(),
      db.legalCase.count(),
      db.payment.count(),
      db.transaction.count(),
      db.supplier.count(),
      db.loan.count(),
      db.account.count(),
      db.journalEntry.count(),
      db.user.count(),
      db.auditLog.count(),
      db.restorePoint.count(),
      countVouchers(),
    ]);
    return NextResponse.json({ buildings, units, maintenance, files, tenants, contracts, legalCases, payments, transactions, suppliers, loans, accounts, journal, users, audit, restore, voucherRegister: vouchers });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}
