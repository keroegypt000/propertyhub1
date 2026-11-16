import { NextRequest, NextResponse } from 'next/server';
import { db, withDbRetry } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { removeAutoEntry, recomputeSupplierInvoiceStatus } from '@/lib/accounting';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.supplierPayment.findUnique({ where: { id }, include: { supplier: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    // معاملة واحدة: حذف القيد + حذف الدفعة + إعادة حساب حالة المستحق + التدقيق — اتصال واحد وذرية كاملة
    await withDbRetry(() => db.$transaction(async (tdb) => {
      await removeAutoEntry(tdb, 'supplierPayment', id);
      await tdb.supplierPayment.delete({ where: { id } });
      // الدفعة كانت تسدد مستحقًا؟ أعد حساب حالة السداد (paid/partial/unpaid)
      if (old.invoiceId) await recomputeSupplierInvoiceStatus(tdb, old.invoiceId);
      await logAudit(user.id, 'delete', 'supplierPayment', id, old as any, `حذف دفعة ${old.amount} د.ك للمورد ${old.supplier?.name || ''}`, tdb);
    }));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
