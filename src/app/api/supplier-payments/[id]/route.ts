import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { removeAutoEntry } from '@/lib/accounting';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.supplierPayment.findUnique({ where: { id }, include: { supplier: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    try { await removeAutoEntry(db, 'supplierPayment', id); } catch (e: any) { console.error('[supplier-payment DELETE entry]', e?.message); }
    await db.supplierPayment.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'supplierPayment', id, old as any, `حذف دفعة ${old.amount} د.ك للمورد ${old.supplier?.name || ''}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
