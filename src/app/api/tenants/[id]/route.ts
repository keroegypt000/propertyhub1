import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const tenant = await db.tenant.findUnique({ where: { id }, include: { contracts: { include: { unit: true } } } });
    if (!tenant) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'tenants')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.tenant.findUnique({ where: { id } });
    const tenant = await db.tenant.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'tenant', id, { before: old, after: body }, `تعديل مستأجر: ${body.name || old?.name}`);
    return NextResponse.json(tenant);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'tenants')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.tenant.findUnique({ where: { id } });
    await db.tenant.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'tenant', id, old, `حذف مستأجر: ${old?.name}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
