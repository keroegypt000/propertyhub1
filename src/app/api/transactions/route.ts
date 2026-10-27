import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'transactions')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const transactions = await db.transaction.findMany({
      orderBy: { date: 'desc' },
      include: { building: true },
    });
    return NextResponse.json(transactions);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'transactions')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const transaction = await db.transaction.create({ data: body });
    await logAudit(user.id, 'create', 'transaction', transaction.id, body, `إنشاء معاملة: ${body.category}`);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
