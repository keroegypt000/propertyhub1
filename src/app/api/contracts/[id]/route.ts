import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validateContract, syncUnitOccupancy } from '@/lib/contracts';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const contract = await db.contract.findUnique({
      where: { id },
      include: {
        unit: { include: { building: true } }, tenant: true, payments: true,
        attachments: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, contractId: true, uploadedBy: true, createdAt: true,
          },
        },
      },
    });
    if (!contract) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.contract.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: 'العقد غير موجود' }, { status: 404 });

    const validationError = await validateContract(body, id);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const newStatus = body.status || old.status;
    const contract = await db.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: {
          unitId: body.unitId || old.unitId,
          tenantId: body.tenantId || old.tenantId,
          startDate: body.startDate ? new Date(body.startDate) : old.startDate,
          endDate: body.endDate ? new Date(body.endDate) : old.endDate,
          rentAmount: body.rentAmount !== undefined ? Number(body.rentAmount) : old.rentAmount,
          deposit: body.deposit !== undefined && body.deposit !== '' ? Number(body.deposit) : old.deposit,
          paymentDay: body.paymentDay ? Number(body.paymentDay) : old.paymentDay,
          status: newStatus,
          vacatedDate: body.vacatedDate !== undefined ? body.vacatedDate : old.vacatedDate,
          refund: body.refund !== undefined && body.refund !== '' ? Number(body.refund) : old.refund,
          terms: body.terms !== undefined ? body.terms : old.terms,
          notes: body.notes !== undefined ? body.notes : old.notes,
        },
      });
      // مزامنة إشغال الوحدة: تفعيل → مؤجرة | إنهاء/إخلاء → متاحة (مع إرجاع الوحدة القديمة عند تغييرها)
      if (body.unitId && body.unitId !== old.unitId) {
        await tx.unit.update({ where: { id: old.unitId }, data: { status: 'available' } }).catch(() => null);
        await tx.unit.update({ where: { id: body.unitId }, data: { status: 'rented' } }).catch(() => null);
      } else if (newStatus !== old.status) {
        await syncUnitOccupancy(updated.unitId, newStatus);
      }
      return updated;
    });

    await logAudit(user.id, 'update', 'contract', id, { before: old, after: body }, `تعديل عقد`);
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.contract.findUnique({ where: { id }, select: { unitId: true, status: true } });
    if (!old) return NextResponse.json({ error: 'العقد غير موجود' }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.contract.delete({ where: { id } });
      // إعادة الوحدة متاحة عند حذف عقد نشط (الدفعات ترحل مع العقد عبر Cascade — سجل مالي محفوظ في نقاط الاستعادة)
      if (['active', 'renewed'].includes(old.status)) {
        await tx.unit.update({ where: { id: old.unitId }, data: { status: 'available' } }).catch(() => null);
      }
    });
    await logAudit(user.id, 'delete', 'contract', id, undefined, `حذف عقد`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
