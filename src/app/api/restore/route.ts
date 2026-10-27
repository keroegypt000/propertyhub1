import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }
    const points = await db.restorePoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, name: true, username: true } } },
    });
    return NextResponse.json(points);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }

    const body = await request.json();
    const name = body.name || `نقطة استعادة - ${new Date().toLocaleString('ar')}`;
    const description = body.description || '';

    // Serialize all data
    const [buildings, units, tenants, contracts, payments, maintenance, files, transactions, loans, loanPayments, accounts, journalEntries] = await Promise.all([
      db.building.findMany(),
      db.unit.findMany(),
      db.tenant.findMany(),
      db.contract.findMany(),
      db.payment.findMany(),
      db.maintenanceRequest.findMany(),
      db.fileUpload.findMany({
        select: {
          id: true, filename: true, originalName: true, mimeType: true, size: true,
          category: true, contractId: true, maintenanceId: true, tenantId: true,
          uploadedBy: true, createdAt: true,
        },
      }),
      db.transaction.findMany(),
      db.loan.findMany(),
      db.loanPayment.findMany(),
      db.account.findMany(),
      db.journalEntry.findMany(),
    ]);

    const snapshot = JSON.stringify({ buildings, units, tenants, contracts, payments, maintenance, files, transactions, loans, loanPayments, accounts, journalEntries });

    const point = await db.restorePoint.create({
      data: { name, description, snapshot, createdBy: user.id },
    });

    await logAudit(user.id, 'create', 'restore', point.id, undefined, `إنشاء نقطة استعادة: ${name}`);
    return NextResponse.json(point, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
