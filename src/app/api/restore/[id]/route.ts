import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    const { id } = await params;
    const point = await db.restorePoint.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true, username: true } } },
    });
    if (!point) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(point);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    const { id } = await params;
    const point = await db.restorePoint.findUnique({ where: { id } });
    if (!point) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    const data = JSON.parse(point.snapshot);

    // Clear existing data (except users and audit logs)
    await db.$transaction(async (tx) => {
      await tx.payment.deleteMany();
      await tx.fileUpload.deleteMany();
      await tx.contract.deleteMany();
      await tx.maintenanceRequest.deleteMany();
      await tx.unit.deleteMany();
      await tx.tenant.deleteMany();
      await tx.building.deleteMany();
      await tx.loanPayment.deleteMany();
      await tx.loan.deleteMany();
      await tx.journalEntry.deleteMany();
      await tx.account.deleteMany();
      await tx.transaction.deleteMany();

      // Restore from snapshot
      if (data.buildings?.length) await tx.building.createMany({ data: data.buildings });
      if (data.units?.length) await tx.unit.createMany({ data: data.units });
      if (data.tenants?.length) await tx.tenant.createMany({ data: data.tenants });
      if (data.contracts?.length) await tx.contract.createMany({ data: data.contracts });
      if (data.payments?.length) await tx.payment.createMany({ data: data.payments });
      if (data.maintenance?.length) await tx.maintenanceRequest.createMany({ data: data.maintenance });
      if (data.files?.length) await tx.fileUpload.createMany({ data: data.files });
      if (data.transactions?.length) await tx.transaction.createMany({ data: data.transactions });
      if (data.loans?.length) await tx.loan.createMany({ data: data.loans });
      if (data.loanPayments?.length) await tx.loanPayment.createMany({ data: data.loanPayments });
      if (data.accounts?.length) await tx.account.createMany({ data: data.accounts });
      if (data.journalEntries?.length) await tx.journalEntry.createMany({ data: data.journalEntries });
    });

    await logAudit(user.id, 'restore', 'restore', id, undefined, `استعادة من نقطة: ${point.name}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في الاستعادة' }, { status: 500 });
  }
}
