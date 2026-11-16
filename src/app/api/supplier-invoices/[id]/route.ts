import { NextRequest, NextResponse } from 'next/server';
import { db, withDbRetry, ValidationError } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncSupplierInvoiceEntry, removeAutoEntry, upsertAutoEntry, recomputeSupplierInvoiceStatus, resolveCashAccountCode, ACC } from '@/lib/accounting';

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
    if (body.accountCode === '') throw new ValidationError('حساب المصروف مطلوب');

    // معاملة واحدة: تحديث المستحق + القيد المحاسبي + التدقيق — اتصال واحد وذرية كاملة
    const invoice = await withDbRetry(() => db.$transaction(async (tdb) => {
      // تحذير لو المبلغ الجديد أقل من المدفوع عليه — يُحسب داخل المعاملة على أحدث حالة
      const paid = await tdb.supplierPayment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
      const paidAmount = Number(paid._sum.amount) || 0;
      if (Math.round(amount * 1000) / 1000 < paidAmount) {
        throw new ValidationError(`المبلغ الجديد (${amount} د.ك) أقل من المسدد فعلاً على المستحق (${paidAmount} د.ك) — احذف الدفعات الزائدة أولًا`);
      }
      const inv = await tdb.supplierInvoice.update({
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
      await syncSupplierInvoiceEntry(tdb, { ...inv, supplier: old.supplier });
      // المبلغ تغيّر — أعد حساب حالة السداد (قد يصير مسددًا بالكامل لو خُفض للمسدد بالضبط)
      if (paidAmount > 0) await recomputeSupplierInvoiceStatus(tdb, id);
      await logAudit(user.id, 'update', 'supplierInvoice', id, body, `تعديل مستحق ${old.supplier?.name || ''}`, tdb);
      return { inv, paidAmount };
    }));

    return NextResponse.json({ ...invoice.inv, paidAmount: invoice.paidAmount, entryWarning: null });
  } catch (error: any) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[supplier-invoices PUT]', error?.message || error);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.supplierInvoice.findUnique({ where: { id }, include: { supplier: true, payments: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    // معاملة واحدة: تحويل قيود الدفعات لمصروف مباشر + حذف قيد المستحق + حذف المستحق + التدقيق
    // الدفعات تبقى بعد الحذف (invoiceId يُزال تلقائيًا SetNull) لكن قيودها تتحول من 2101 إلى المصروف
    await withDbRetry(() => db.$transaction(async (tdb) => {
      // 1) قيود الدفعات المرتبطة تتحول من حساب المورد 2101 إلى حساب المصروف مباشرة
      for (const p of old.payments) {
        await upsertAutoEntry(tdb, {
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
      }
      // 2) حذف قيد المستحق (مدين المصروف / دائن 2101)
      await removeAutoEntry(tdb, 'supplierInvoice', id);
      // 3) حذف المستحق نفسه
      await tdb.supplierInvoice.delete({ where: { id } });
      await logAudit(user.id, 'delete', 'supplierInvoice', id, old as any, `حذف مستحق ${old.amount} د.ك للمورد ${old.supplier?.name || ''} مع تحويل قيود ${old.payments.length} دفعة لمصروف مباشر`, tdb);
    }));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[supplier-invoices DELETE]', error?.message || error);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
