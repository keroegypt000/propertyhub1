import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const entry = await db.journalEntry.findUnique({ where: { id } });
    if (!entry) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.journalEntry.findUnique({ where: { id } });
    const entry = await db.journalEntry.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'journalEntry', id, { before: old, after: body }, `تعديل قيد: ${body.description || old?.description}`);
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.journalEntry.findUnique({ where: { id } });
    await db.journalEntry.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'journalEntry', id, old, `حذف قيد: ${old?.description}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
