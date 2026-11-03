import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncMaintenanceEntry } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const items = await db.maintenanceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        unit: { include: { building: true } },
        building: true,
        attachments: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, maintenanceId: true, uploadedBy: true, createdAt: true,
          },
        },
      },
    });
    return NextResponse.json(items);
  } catch (error: any) {
    // تمييز خطأ المصادقة الحقيقي عن أخطاء الخادم الأخرى (كان يُخفي أخطاء Prisma كـ"غير مصرح")
    if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('[maintenance GET]', error?.message);
    return NextResponse.json({ error: error.message || 'خطأ في تحميل طلبات الصيانة' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'maintenance')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    // الحقول المسموح بها — buildingId يحفظ العمارة لصيانة العقار بكاملها (بدون وحدة)
    const data: any = {
      title: body.title, description: body.description || null, category: body.category || null,
      priority: body.priority || 'medium', status: body.status || 'open',
      unitId: body.unitId || null, buildingId: body.buildingId || null,
      estimatedCost: body.estimatedCost ?? null, cost: body.cost ?? null,
    };
    if (!data.unitId && data.buildingId) {
      const b = await db.building.findUnique({ where: { id: data.buildingId }, select: { id: true } });
      if (!b) return NextResponse.json({ error: 'العمارة غير موجودة' }, { status: 400 });
    }
    if (data.unitId) {
      const u = await db.unit.findUnique({ where: { id: data.unitId }, include: { building: { select: { id: true } } } });
      if (!u) return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 400 });
      data.buildingId = u.building.id; // العمارة تُملأ تلقائياً من الوحدة
    }
    const item = await db.maintenanceRequest.create({ data });
    await logAudit(user.id, 'create', 'maintenance', item.id, body, `إنشاء طلب صيانة: ${body.title}`);
    // إن أُنشئ الطلب مكتملًا بتكلفة فعلية → توليد قيد مصروف الصيانة فورًا
    let entryWarning: string | null = null;
    try {
      const withUnit = await db.maintenanceRequest.findUnique({ where: { id: item.id }, include: { unit: true } });
      if (withUnit) await syncMaintenanceEntry(db, withUnit);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد قيد الصيانة';
      console.error('[maintenance POST entry]', entryWarning);
    }
    return NextResponse.json({ ...item, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
