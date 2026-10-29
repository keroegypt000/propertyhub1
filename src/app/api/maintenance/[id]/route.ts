import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncMaintenanceEntry, removeAutoEntry } from '@/lib/accounting';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const item = await db.maintenanceRequest.findUnique({ where: { id }, include: {
      attachments: {
        select: {
          id: true, filename: true, originalName: true, mimeType: true, size: true,
          category: true, maintenanceId: true, uploadedBy: true, createdAt: true,
        },
      },
    } });
    if (!item) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error: any) {
    if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('[maintenance GET:id]', error?.message);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'maintenance')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.maintenanceRequest.findUnique({ where: { id } });
    const item = await db.maintenanceRequest.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'maintenance', id, { before: old, after: body }, `تعديل طلب صيانة`);

    // مزامنة قيد مصروف الصيانة مع الحالة والتكلفة الجديدة
    let entryWarning: string | null = null;
    try {
      const withUnit = await db.maintenanceRequest.findUnique({ where: { id }, include: { unit: true } });
      if (withUnit) await syncMaintenanceEntry(db, withUnit);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر مزامنة قيد الصيانة';
      console.error('[maintenance PUT entry]', entryWarning);
    }
    return NextResponse.json({ ...item, entryWarning });
  } catch (error: any) {
    if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('[maintenance PUT]', error?.message);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'maintenance')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.maintenanceRequest.findUnique({ where: { id } });
    await db.maintenanceRequest.delete({ where: { id } });
    // حذف قيد مصروف الصيانة المرتبط بالطلب المحذوف
    try { await removeAutoEntry(db, 'maintenance', id); } catch (e: any) { console.error('[maintenance DELETE entry]', e?.message); }
    await logAudit(user.id, 'delete', 'maintenance', id, old || undefined, `حذف طلب صيانة`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('[maintenance DELETE]', error?.message);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}
