import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validateContract } from '@/lib/contracts';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const contracts = await db.contract.findMany({
      orderBy: { createdAt: 'desc' },
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
    return NextResponse.json(contracts);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const validationError = await validateContract(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    // معاملة ذرية: إنشاء العقد + تحديث إشغال الوحدة (منع تسابقات الإنشاء المزدوج)
    const contract = await db.$transaction(async (tx) => {
      const created = await tx.contract.create({ data: {
        unitId: body.unitId,
        tenantId: body.tenantId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        rentAmount: Number(body.rentAmount),
        deposit: body.deposit !== undefined && body.deposit !== null && body.deposit !== '' ? Number(body.deposit) : 0,
        paymentDay: body.paymentDay ? Number(body.paymentDay) : null,
        status: body.status || 'active',
        vacatedDate: body.vacatedDate || null,
        refund: body.refund !== undefined && body.refund !== null && body.refund !== '' ? Number(body.refund) : null,
        terms: body.terms || null,
        notes: body.notes || null,
      }});
      await tx.unit.update({ where: { id: body.unitId }, data: { status: 'rented' } }).catch(() => null);
      return created;
    });

    await logAudit(user.id, 'create', 'contract', contract.id, body, `إنشاء عقد`);
    return NextResponse.json(contract, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
