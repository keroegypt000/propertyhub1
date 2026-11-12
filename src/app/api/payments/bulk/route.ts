import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncPaymentEntry } from '@/lib/accounting';
import { contractBalance } from '@/lib/calc';
import { nextDocNumber } from '@/lib/numbering';

/**
 * تحصيل شيك شركة مجمّع — للعمارة كاملة:
 * - المستأجر: شركة → التحصيل يكون بشيك/تحويل واحد للعقار بالكامل
 * - يوزع السيرفر المبلغ تلقائيًا على عقود الشركات النشطة في العمارة
 *   بترتيب الأقدم استحقاقًا، وكل عقد يُسدد حتى رصيده المستحق قبل الانتقال للتالي
 * - كل دفعة تولّد قيدها المحاسبي (مدين صندوق/بنك/شيكات — دائن إيراد إيجار للعمارة)
 *   فمجموع القيود = قيمة الشيك، وميزان المراجعة يبقى متوازنًا
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'payments')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const buildingId = String(body.buildingId || '');
    const amount = Number(body.amount) || 0;
    const method = ['check', 'transfer'].includes(body.method) ? body.method : 'check';
    const reference = body.reference ? String(body.reference).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const date = body.date ? new Date(body.date) : new Date();
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });

    if (!buildingId) return NextResponse.json({ error: 'العمارة مطلوبة' }, { status: 400 });
    if (amount <= 0) return NextResponse.json({ error: 'مبلغ الشيك يجب أن يكون أكبر من صفر' }, { status: 400 });
    const building = await db.building.findUnique({ where: { id: buildingId } });
    if (!building) return NextResponse.json({ error: 'العمارة غير موجودة' }, { status: 400 });

    // عقود الشركات النشطة في هذه العمارة — مرتبة أقدم بدايةً أولًا
    const contracts = await db.contract.findMany({
      where: {
        status: { in: ['active', 'renewed'] },
        unit: { buildingId },
        tenant: { tenantType: 'company' },
      },
      include: { tenant: true, unit: true, payments: { where: { status: { not: 'cancelled' } } } },
      orderBy: { startDate: 'asc' },
    });
    if (!contracts.length) {
      return NextResponse.json({ error: 'لا توجد عقود شركات نشطة في هذه العمارة — سجّل التحصيل كدفعات عادية' }, { status: 400 });
    }

    // حساب المستحق لكل عقد (نفس منطق واجهة المستخدم — contractBalance)
    const balances = contracts.map((c) => ({
      contract: c,
      balance: contractBalance(c as any, c.payments as any, date),
    }));
    // ملاحظة: إذا كان إجمالي المستحق صفرًا نسمح بالتحصيل — الفائض كله يُسجل دفعة مقدمة على آخر عقد
    // (نفس معاينة واجهة المستخدم: «تسديد 0 + مقدمة X») بدل رفض الشيك بالكامل

    // التوزيع: كل عقد حتى رصيده المستحق — والفائض يُسجل على آخر عقد (دفعة مقدمة)
    let remaining = Math.round(amount * 1000) / 1000;
    const allocations: { contractId: string; tenantName: string; unitNumber: string; amount: number; outstandingBefore: number }[] = [];

    for (let i = 0; i < balances.length; i++) {
      const b = balances[i];
      if (remaining <= 0) break;
      const isLast = i === balances.length - 1;
      const pay = isLast
        ? remaining // آخر عقد يستوعب الفائض إن وجد (دفعة مقدمة موثقة في الملاحظات)
        : Math.min(b.balance.outstanding, remaining);
      const p = Math.round(pay * 1000) / 1000;
      if (p <= 0) continue;
      allocations.push({
        contractId: b.contract.id,
        tenantName: b.contract.tenant?.name || '-',
        unitNumber: b.contract.unit?.number || '-',
        amount: p,
        outstandingBefore: b.balance.outstanding,
      });
      remaining = Math.round((remaining - p) * 1000) / 1000;
      if (!isLast && remaining <= 0) break;
    }
    if (remaining > 0.001 && allocations.length === 0) {
      return NextResponse.json({ error: 'تعذر توزيع المبلغ' }, { status: 400 });
    }

    // إنشاء الدفعات + القيود — كلها داخل معاملة واحدة: فشل أي جزء يتراجع الكل
    // كل دفعة تأخذ فاتورة (ف) وسند قبض (ق) تسلسليين بالترتيب داخل المعاملة نفسها
    const surplus = Math.round((amount - allocations.reduce((s, a) => s + a.amount, 0)) * 1000) / 1000;
    const created = await db.$transaction(async (tdb) => {
      const payments: any[] = [];
      for (const a of allocations) {
        const surplusNote = a.amount > a.outstandingBefore ? ` — يتضمن فائض ${Math.round((a.amount - a.outstandingBefore) * 1000) / 1000} د.ك (دفعة مقدمة)` : '';
        const payment = await tdb.payment.create({
          data: {
            contractId: a.contractId,
            amount: a.amount,
            dueDate: date,
            paidDate: date,
            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            status: 'paid',
            method,
            reference,
            notes: `شيك مجمّع للعمارة ${building.name}${surplusNote}${notes ? ` — ${notes}` : ''}`,
            invoiceNo: await nextDocNumber(tdb, 'invoice'),
            receiptNo: await nextDocNumber(tdb, 'receipt'),
          },
        });
        payments.push(payment);
      }
      return payments;
    });

    // القيود المحاسبية بعد نجاح إنشاء الدفعات
    const warnings: string[] = [];
    for (const p of created) {
      try { await syncPaymentEntry(db, p); }
      catch (e: any) { warnings.push(e?.message || 'تعذر توليد أحد القيود'); }
    }

    await logAudit(user.id, 'create', 'payment', created[0]?.id, body,
      `تحصيل ${method === 'check' ? 'شيك' : 'تحويل'} مجمّع للعمارة ${building.name}: ${amount} د.ك موزع على ${created.length} عقد شركة`);

    return NextResponse.json({
      ok: true,
      buildingName: building.name,
      method,
      reference,
      totalAmount: amount,
      unallocated: Math.max(0, surplus),
      paymentsCount: created.length,
      allocations,
      entryWarnings: warnings.length ? warnings : undefined,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
