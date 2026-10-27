import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const contract = await db.contract.findUnique({
      where: { id },
      include: { unit: { include: { building: true } }, tenant: true, payments: true, attachments: true },
    });
    if (!contract) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.contract.findUnique({ where: { id } });
    const contract = await db.contract.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'contract', id, { before: old, after: body }, `تعديل عقد`);
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    await db.contract.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'contract', id, undefined, `حذف عقد`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
