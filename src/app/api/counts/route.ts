import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

// =============================================================
// GET /api/counts — عدد سجلات كل قسم في طلب واحد خفيف
// يغذي شارات العدد في القائمة الجانبية بحيث يرى المستخدم حجم بيانات
// كل صفحة قبل فتحها (ومنع اللبس: الرقم القديم جانب المجموعات كان عدد
// بنود المجموعة لا عدد السجلات).
// =============================================================

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const [buildings, units, maintenance, files, tenants, contracts, legalCases, payments, transactions, suppliers, loans, accounts, journal, users, audit, restore] = await Promise.all([
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
    ]);
    return NextResponse.json({ buildings, units, maintenance, files, tenants, contracts, legalCases, payments, transactions, suppliers, loans, accounts, journal, users, audit, restore });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}
