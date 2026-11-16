import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { duplicateNameError } from '@/lib/unique';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'buildings')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const buildings = await db.building.findMany({ orderBy: { createdAt: 'desc' }, include: { units: true, transactions: true } });
    return NextResponse.json(buildings);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'buildings')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'اسم العمارة مطلوب' }, { status: 400 });
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'كود العمارة مطلوب' }, { status: 400 });
    // منع التكرار — اسم العمارة لا يتكرر، وكود العمارة فريد في قاعدة البيانات
    const all = await db.building.findMany({ select: { id: true, name: true } });
    const dup = duplicateNameError(all, name, { field: 'اسم العمارة' });
    if (dup) return NextResponse.json({ error: dup }, { status: 400 });
    const codeTaken = await db.building.findUnique({ where: { code } });
    if (codeTaken) return NextResponse.json({ error: `كود العمارة «${code}» مستخدم بالفعل في عمارة «${codeTaken.name}»` }, { status: 400 });
    const building = await db.building.create({ data: { ...body, name, code } });
    await logAudit(user.id, 'create', 'building', building.id, body, `إنشاء مبنى: ${body.name}`);
    return NextResponse.json(building, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
