import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { duplicateNameError } from '@/lib/unique';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const building = await db.building.findUnique({ where: { id }, include: { units: true, transactions: true } });
    if (!building) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(building);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'buildings')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.building.findUnique({ where: { id } });
    // منع التكرار عند التعديل — الاسم والكود مع استثناء العمارة نفسها
    const data: any = { ...body };
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'اسم العمارة مطلوب' }, { status: 400 });
      const all = await db.building.findMany({ select: { id: true, name: true } });
      const dup = duplicateNameError(all, name, { excludeId: id, field: 'اسم العمارة' });
      if (dup) return NextResponse.json({ error: dup }, { status: 400 });
      data.name = name;
    }
    if (body.code !== undefined) {
      const code = String(body.code || '').trim();
      if (!code) return NextResponse.json({ error: 'كود العمارة مطلوب' }, { status: 400 });
      const codeTaken = await db.building.findUnique({ where: { code } });
      if (codeTaken && codeTaken.id !== id) return NextResponse.json({ error: `كود العمارة «${code}» مستخدم بالفعل في عمارة «${codeTaken.name}»` }, { status: 400 });
      data.code = code;
    }
    const building = await db.building.update({ where: { id }, data });
    await logAudit(user.id, 'update', 'building', id, { before: old, after: body }, `تعديل مبنى: ${body.name || old?.name}`);
    return NextResponse.json(building);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'buildings')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.building.findUnique({ where: { id } });
    await db.building.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'building', id, old || undefined, `حذف مبنى: ${old?.name}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
