import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { duplicateNameError } from '@/lib/unique';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const account = await db.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(account);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'accounts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.account.findUnique({ where: { id } });
    // منع التكرار عند التعديل — الاسم والرقم مع استثناء الحساب نفسه
    const data: any = { ...body };
    if (body.code !== undefined) {
      const code = String(body.code || '').trim();
      if (!code) return NextResponse.json({ error: 'رقم الحساب مطلوب' }, { status: 400 });
      const codeTaken = await db.account.findUnique({ where: { code } });
      if (codeTaken && codeTaken.id !== id) return NextResponse.json({ error: `رقم الحساب «${code}» مستخدم بالفعل لحساب «${codeTaken.name}»` }, { status: 400 });
      data.code = code;
    }
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'اسم الحساب مطلوب' }, { status: 400 });
      const all = await db.account.findMany({ select: { id: true, name: true } });
      const dup = duplicateNameError(all, name, { excludeId: id, field: 'اسم الحساب' });
      if (dup) return NextResponse.json({ error: dup }, { status: 400 });
      data.name = name;
    }
    const account = await db.account.update({ where: { id }, data });
    await logAudit(user.id, 'update', 'account', id, { before: old, after: body }, `تعديل حساب: ${body.name || old?.name}`);
    return NextResponse.json(account);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin') return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.account.findUnique({ where: { id } });
    await db.account.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'account', id, old || undefined, `حذف حساب: ${old?.name}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
