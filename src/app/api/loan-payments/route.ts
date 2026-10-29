import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncLoanPaymentEntry } from '@/lib/accounting';

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

    // تحقق من الحقول: principal (الأصل) و interest (الفائدة) — وقبول amount للتوافق مع النماذج القديمة
    if (!body.loanId) return NextResponse.json({ error: 'القرض مطلوب' }, { status: 400 });
    const loan = await db.loan.findUnique({ where: { id: body.loanId } });
    if (!loan) return NextResponse.json({ error: 'القرض غير موجود' }, { status: 400 });
    const legacyAmount = body.amount !== undefined && body.principal === undefined && body.interest === undefined
      ? Number(body.amount) : null; // نماذج قديمة كانت ترسل amount وحيدًا
    const principal = legacyAmount !== null ? legacyAmount : Number(body.principal) || 0;
    const interest = legacyAmount !== null ? 0 : Number(body.interest) || 0;
    if (principal < 0 || interest < 0) return NextResponse.json({ error: 'المبالغ لا يمكن أن تكون سالبة' }, { status: 400 });
    if (principal + interest <= 0) return NextResponse.json({ error: 'أدخل مبلغ الأصل أو الفائدة' }, { status: 400 });

    const payment = await db.loanPayment.create({
      data: {
        loanId: body.loanId,
        date: body.date || new Date().toISOString().slice(0, 10),
        principal,
        interest,
        notes: body.notes || null,
      },
    });
    await logAudit(user.id, 'create', 'loanPayment', payment.id, { loanId: body.loanId, principal, interest }, `إنشاء سداد قرض: ${loan.name}`);

    // توليد قيد سداد القرض (مدين أصل القرض + الفوائد / دائن البنك)
    let entryWarning: string | null = null;
    try {
      const withLoan = await db.loanPayment.findUnique({ where: { id: payment.id }, include: { loan: true } });
      if (withLoan) await syncLoanPaymentEntry(db, withLoan);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد قيد السداد';
      console.error('[loan-payments POST entry]', entryWarning);
    }
    return NextResponse.json({ ...payment, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
