import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'loans')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const payments = await db.loanPayment.findMany({
      orderBy: { date: 'desc' },
      include: { loan: true },
    });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'loans')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const payment = await db.loanPayment.create({ data: body });
    await logAudit(user.id, 'create', 'loanPayment', payment.id, body, `إنشاء سداد قرض`);
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
