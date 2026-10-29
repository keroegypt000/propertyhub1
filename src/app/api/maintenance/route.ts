import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const items = await db.maintenanceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        unit: { include: { building: true } },
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
    const item = await db.maintenanceRequest.create({ data: body });
    await logAudit(user.id, 'create', 'maintenance', item.id, body, `إنشاء طلب صيانة: ${body.title}`);
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
