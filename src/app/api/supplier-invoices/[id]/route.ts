import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncSupplierInvoiceEntry, removeAutoEntry, upsertAutoEntry, resolveCashAccountCode, ACC } from '@/lib/accounting';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.supplierInvoice.findUnique({ where: { id }, include: { supplier: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });

    // تحذير لو المبلغ الجديد أقل من المدفوع عليه
    const paid = await db.supplierPayment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
    const paidAmount = Number(paid._sum.amount) || 0;

    const invoice = await db.supplierInvoice.update({
      where: { id },
      data: {
        buildingId: body.buildingId !== undefined ? (body.buildingId || null) : undefined,
        unitId: body.unitId !== undefined ? (body.unitId || null) : undefined,
        amount: Math.round(amount * 1000) / 1000,
        date: body.date ? String(body.date).slice(0, 10) : undefined,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? String(body.dueDate).slice(0, 10) : null) : undefined,
        description: body.description !== undefined ? (body.description ? String(body.description).trim() : null) : undefined,
        accountCode: body.accountCode ? String(body.accountCode) : undefined,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined,
      },
    });

    // تحديث القيد المحاسبي بالمبلغ والحساب الجديدين (upsert على نفس المصدر)
    let entryWarning: string | null = null;
    try {
      await syncSupplierInvoiceEntry(db, { ...invoice, supplier: old.supplier });
    } catch (e: any) {
      entryWarning = e?.message || 'تعذر تحديث القيد المحاسبي';
      console.error('[supplier-invoice PUT entry]', entryWarning);
    }

    await logAudit(user.id, 'update', 'supplierInvoice', id, body, `تعديل مستحق ${old.supplier?.name || ''}`);
    return NextResponse.json({ ...invoice, paidAmount, entryWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.supplierInvoice.findUnique({ where: { id }, include: { supplier: true, payments: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    // 1) حذف قيد المستحق (مدين المصروف / دائن 2101)
    try { await removeAutoEntry(db, 'supplierInvoice', id); } catch (e: any) { console.error('[supplier-invoice DELETE entry]', e?.message); }

    // 2) الدفعات المرتبطة تصبح دفعات عامة — قيودها تتحول من حساب المورد 2101 إلى حساب المصروف مباشرة
    for (const p of old.payments) {
      try {
        await upsertAutoEntry(db, {
          source: 'supplierPayment',
          sourceId: p.id,
          date: p.date,
          description: `دفعة ${old.supplier?.type === 'contractor' ? 'لمقاول' : 'لمورد'} — ${old.supplier?.name || ''}${p.description ? ` — ${p.description}` : ''}`,
          buildingId: p.buildingId,
          lines: [
            { accountCode: p.accountCode || ACC.MISC_EXPENSE, debit: p.amount },
            { accountCode: resolveCashAccountCode(p.method), credit: p.amount },
          ],
        });
      } catch (e: any) { console.error('[supplier-invoice DELETE payment entry]', e?.message); }
    }

    // 3) حذف المستحق — الدفعات تبقى (invoiceId يُزال تلقائيًا SetNull)
    await db.supplierInvoice.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'supplierInvoice', id, old as any, `حذف مستحق ${old.amount} د.ك للمورد ${old.supplier?.name || ''} مع تحويل قيود ${old.payments.length} دفعة لمصروف مباشر`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
