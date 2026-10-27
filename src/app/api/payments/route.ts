import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const payments = await db.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { contract: { include: { unit: true, tenant: true } } },
    });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'payments')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const payment = await db.payment.create({ data: body });
    await logAudit(user.id, 'create', 'payment', payment.id, body, `تسجيل دفعة`);
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
