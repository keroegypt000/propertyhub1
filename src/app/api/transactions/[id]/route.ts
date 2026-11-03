import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncTransactionEntry, removeAutoEntry } from '@/lib/accounting';

// الحقول المسموح بها فقط — يمنع تمرير حقول دخيلة إلى Prisma
function cleanBody(body: any) {
  const data: any = {};
  if (body.date !== undefined) data.date = String(body.date);
  if (body.buildingId !== undefined) data.buildingId = body.buildingId || null;
  if (body.type !== undefined) data.type = body.type === 'income' ? 'income' : 'expense';
  if (body.category !== undefined) data.category = String(body.category).trim();
  if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
  if (body.account !== undefined) data.account = body.account ? String(body.account).trim() : null;
  if (body.cashAccount !== undefined) data.cashAccount = body.cashAccount ? String(body.cashAccount) : 'cash';
  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const transaction = await db.transaction.findUnique({
      where: { id },
      include: { building: true },
    });
    if (!transaction) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(transaction);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'transactions')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.transaction.findUnique({ where: { id } });
    const transaction = await db.transaction.update({ where: { id }, data: cleanBody(body) });
    await logAudit(user.id, 'update', 'transaction', id, { before: old, after: body }, `تعديل معاملة: ${body.category || old?.category}`);
    // إعادة توليد القيد المزدوج بالبيانات الجديدة (upsert — يحدّث القيد القائم)
    let entryWarning: string | null = null;
    try { await syncTransactionEntry(db, transaction); }
    catch (entryErr: any) { entryWarning = entryErr?.message || 'تعذر توليد القيد المحاسبي'; console.error('[transactions PUT entry]', entryWarning); }
    return NextResponse.json({ ...transaction, entryWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager')
      return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.transaction.findUnique({ where: { id } });
    // حذف القيد المحاسبي المرتبط أولًا ثم الحركة — القيدتان يبقيان متوازنتين دائمًا
    await removeAutoEntry(db, 'transaction', id);
    await db.transaction.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'transaction', id, old || undefined, `حذف معاملة: ${old?.category}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
