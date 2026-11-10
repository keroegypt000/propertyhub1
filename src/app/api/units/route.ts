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

    // حقول مسموحة فقط (يمنع حقول غريبة من الاستيراد)
    const data: any = {};
    if (body.buildingId) data.buildingId = body.buildingId;
    if (body.number !== undefined && body.number !== null) data.number = String(body.number).trim();
    if (body.floor !== undefined) data.floor = body.floor === null || body.floor === '' ? null : Number(body.floor);
    if (body.area !== undefined) data.area = body.area === null || body.area === '' ? null : Number(body.area);
    if (body.type !== undefined) data.type = body.type || null;
    if (body.status !== undefined && body.status) data.status = body.status;
    if (body.rentAmount !== undefined) data.rentAmount = body.rentAmount === null || body.rentAmount === '' ? null : Number(body.rentAmount);
    if (body.notes !== undefined) data.notes = body.notes || null;

    // Upsert: وحدة موجودة بنفس رقم العمارة → تُحدَّث بدل إنشاء مكرر (مهم لإعادة الاستيراد وتصحيح الحالات)
    let existing: any = null;
    if (data.buildingId && data.number) {
      existing = await db.unit.findFirst({ where: { buildingId: data.buildingId, number: data.number } });
    }

    let unit: any;
    if (existing) {
      const { buildingId: _b, number: _n, ...patch } = data;
      unit = await db.unit.update({ where: { id: existing.id }, data: patch });
      await logAudit(user.id, 'update', 'unit', unit.id, body, `تحديث وحدة موجودة (استيراد): ${data.number}`);
      return NextResponse.json({ ...unit, _created: false }, { status: 200 });
    }
    unit = await db.unit.create({ data });
    await logAudit(user.id, 'create', 'unit', unit.id, body, `إنشاء وحدة: ${data.number}`);
    return NextResponse.json({ ...unit, _created: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
