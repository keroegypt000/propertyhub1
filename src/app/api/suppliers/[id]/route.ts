import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { removeAutoEntry } from '@/lib/accounting';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'اسم المورد / المقاول مطلوب' }, { status: 400 });
    const supplier = await db.supplier.update({
      where: { id },
      data: {
        name,
        type: ['contractor', 'supplier'].includes(body.type) ? body.type : 'contractor',
        phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined,
        specialty: body.specialty !== undefined ? (body.specialty ? String(body.specialty).trim() : null) : undefined,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined,
      },
    });
    await logAudit(user.id, 'update', 'supplier', id, body, `تعديل مورد: ${name}`);
    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.supplier.findUnique({ where: { id }, include: { payments: true } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    // حذف القيود المحاسبية المرتبطة بدفعات المورد ثم حذف المورد (الدفعات تُحذف تلقائيًا Cascade)
    for (const p of old.payments) {
      try { await removeAutoEntry(db, 'supplierPayment', p.id); } catch (e: any) { console.error('[supplier DELETE entry]', e?.message); }
    }
    await db.supplier.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'supplier', id, old as any, `حذف مورد: ${old.name} مع ${old.payments.length} دفعة`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
