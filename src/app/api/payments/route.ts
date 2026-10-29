import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncPaymentEntry } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const payments = await db.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { contract: { include: { unit: { include: { building: true } }, tenant: true } } },
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

    // تحقق: العقد موجود والمبلغ صحيح
    if (!body.contractId) return NextResponse.json({ error: 'العقد مطلوب' }, { status: 400 });
    const contract = await db.contract.findUnique({ where: { id: body.contractId } });
    if (!contract) return NextResponse.json({ error: 'العقد غير موجود' }, { status: 400 });
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    if (body.dueDate && isNaN(new Date(body.dueDate).getTime())) {
      return NextResponse.json({ error: 'تاريخ الاستحقاق غير صالح' }, { status: 400 });
    }

    // تصنيف تلقائي: أقل من الإيجار الشهري = دفعة جزئية
    let status = body.status || 'paid';
    if (status === 'paid' && amount < contract.rentAmount) status = 'partial';

    const payment = await db.payment.create({
      data: {
        contractId: body.contractId,
        amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
        paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
        month: body.month || null,
        status,
        method: body.method || 'cash',
        reference: body.reference || null,
        notes: body.notes || null,
      },
    });
    await logAudit(user.id, 'create', 'payment', payment.id, body, `تسجيل دفعة ${amount} على العقد`);

    // توليد القيد المحاسبي التلقائي (تحصيل إيجار) — فشل القيد لا يُسقط الدفعة لكن يُعلن
    let entryWarning: string | null = null;
    try {
      await syncPaymentEntry(db, payment);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد القيد المحاسبي';
      console.error('[payments POST entry]', entryWarning);
    }
    return NextResponse.json({ ...payment, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
