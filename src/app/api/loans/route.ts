import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncLoanEntry } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'loans')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const loans = await db.loan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { payments: true },
    });
    return NextResponse.json(loans);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'loans')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const loan = await db.loan.create({ data: body });
    await logAudit(user.id, 'create', 'loan', loan.id, body, `إنشاء قرض: ${body.name}`);
    // توليد قيد استلام القرض (مدين البنك / دائن أصل القرض)
    let entryWarning: string | null = null;
    try {
      await syncLoanEntry(db, loan);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد قيد القرض';
      console.error('[loans POST entry]', entryWarning);
    }
    return NextResponse.json({ ...loan, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
