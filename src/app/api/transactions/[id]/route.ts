import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
    const transaction = await db.transaction.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'transaction', id, { before: old, after: body }, `تعديل معاملة: ${body.category || old?.category}`);
    return NextResponse.json(transaction);
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
    await db.transaction.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'transaction', id, old, `حذف معاملة: ${old?.category}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
