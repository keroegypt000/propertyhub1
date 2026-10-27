import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
    const building = await db.building.create({ data: body });
    await logAudit(user.id, 'create', 'building', building.id, body, `إنشاء مبنى: ${body.name}`);
    return NextResponse.json(building, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
