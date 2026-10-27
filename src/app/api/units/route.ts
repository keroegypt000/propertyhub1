import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const units = await db.unit.findMany({ orderBy: { createdAt: 'desc' }, include: { building: true } });
    return NextResponse.json(units);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'units')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const unit = await db.unit.create({ data: body });
    await logAudit(user.id, 'create', 'unit', unit.id, body, `إنشاء وحدة: ${body.number}`);
    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
