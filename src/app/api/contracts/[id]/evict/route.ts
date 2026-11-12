import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncUnitOccupancy } from '@/lib/contracts';
import { contractBalance } from '@/lib/calc';
import { syncPaymentEntry } from '@/lib/accounting';

// =============================================================
// POST /api/contracts/[id]/evict — إخلاء فوري وإنهاء العقد
// يدعم حالتين: الخروج المبكر قبل نهاية العقد، والإنهاء عند/بعد نهاية المدة.
// التسوية المالية تُحسب حتى تاريخ الإخلاء (وليس حتى نهاية العقد) مع خيارات:
//   collect = تحصيل المتبقي (+ غرامة الإنهاء المبكر) الآن كدفعة مسددة بقيد محاسبي
//   waive   = إعفاء المستأجر من المتبقي (يُوثَّق في ملاحظات العقد)
//   none    = بدون تسوية الآن
// العقد يتحول «vacated» والوحدة ترجع متاحة والمستأجر يبقى بأرشيفه الكامل.
// =============================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();

    const contract = await db.contract.findUnique({
      where: { id },
      include: { payments: true, unit: { include: { building: true } }, tenant: true },
    });
    if (!contract) return NextResponse.json({ error: 'العقد غير موجود' }, { status: 404 });
    if (!['active', 'renewed'].includes(contract.status)) {
      return NextResponse.json({ error: 'العقد ليس نشطًا — لا يمكن إخلاءه (حالته الحالية: ' + contract.status + ')' }, { status: 400 });
    }

    // التحقق من تاريخ الإخلاء: صالح وليس قبل بداية العقد
    const vacatedDate = body.vacatedDate ? new Date(body.vacatedDate) : new Date();
    if (isNaN(vacatedDate.getTime())) return NextResponse.json({ error: 'تاريخ الإخلاء غير صالح' }, { status: 400 });
    const start = new Date(contract.startDate);
    if (vacatedDate < start) return NextResponse.json({ error: 'تاريخ الإخلاء لا يمكن أن يكون قبل تاريخ بداية العقد' }, { status: 400 });

    const refund = body.refund !== undefined && body.refund !== '' && body.refund !== null ? Number(body.refund) : null;
    if (refund !== null && (isNaN(refund) || refund < 0)) return NextResponse.json({ error: 'مردود التأمين غير صالح' }, { status: 400 });

    // غرامة الإنهاء المبكر (اختيارية — تضاف للمستحق عند التحصيل)
    const penalty = body.penalty !== undefined && body.penalty !== '' && body.penalty !== null ? Number(body.penalty) : 0;
    if (isNaN(penalty) || penalty < 0) return NextResponse.json({ error: 'قيمة الغرامة غير صالحة' }, { status: 400 });

    const settlement = ['collect', 'waive', 'none'].includes(body.settlement) ? body.settlement : 'none';

    // الرصيد حتى تاريخ الإخلاء (وليس حتى نهاية العقد) — هذا صميم الخروج المبكر
    const bal = contractBalance(contract as any, contract.payments as any, vacatedDate);
    const settleAmount = Math.round((bal.outstanding + penalty) * 1000) / 1000;

    const result = await db.$transaction(async (tx) => {
      // 1) تسوية الإخلاء: تحصيل المتبقي + الغرامة كدفعة مسددة فورًا
      let settlementPayment: any = null;
      let entryWarning: string | null = null;
      if (settlement === 'collect' && settleAmount > 0) {
        const payNotes = [
          'تسوية إخلاء',
          bal.outstanding > 0 ? `متبقي ${bal.outstanding} د.ك` : '',
          penalty > 0 ? `غرامة إنهاء مبكر ${penalty} د.ك` : '',
        ].filter(Boolean).join(' + ');
        settlementPayment = await tx.payment.create({
          data: {
            contractId: id,
            amount: settleAmount,
            dueDate: vacatedDate,
            paidDate: vacatedDate,
            month: null,
            status: 'paid',
            method: ['cash', 'transfer', 'check', 'card'].includes(body.method) ? body.method : 'cash',
            reference: body.reference || null,
            notes: payNotes + ' — عند إنهاء العقد وإخلاء الوحدة',
          },
        });
        // القيد المحاسبي جزء من العملية — فشله يُسجَّل تحذيرًا ولا يُسقط الإخلاء
        try { await syncPaymentEntry(tx, settlementPayment); }
        catch (e: any) { entryWarning = e?.message || 'تعذر توليد القيد المحاسبي'; }
      }

      // 2) توثيق الإخلاء في ملاحظات العقد — الملاحظات السابقة تُحفظ دائمًا ولا تُستبدل
      const notesParts: string[] = [];
      if (contract.notes && String(contract.notes).trim()) notesParts.push(String(contract.notes).trim());
      if (body.notes && String(body.notes).trim()) notesParts.push(String(body.notes).trim());
      const end = new Date(contract.endDate);
      if (vacatedDate < end) notesParts.push(`خروج مبكر قبل نهاية العقد بتاريخ ${vacatedDate.toISOString().slice(0, 10)}`);
      if (settlement === 'collect' && settleAmount > 0) {
        notesParts.push(`تسوية إخلاء: تحصيل ${settleAmount} د.ك (${bal.outstanding > 0 ? `متبقي ${bal.outstanding}` : ''}${penalty > 0 ? `${bal.outstanding > 0 ? ' + ' : ''}غرامة إنهاء مبكر ${penalty}` : ''} د.ك)`);
      }
      if (settlement === 'waive' && bal.outstanding > 0) {
        notesParts.push(`إعفاء المستأجر من المتبقي ${bal.outstanding} د.ك عند الإخلاء${penalty > 0 ? ` والتنازل عن غرامة ${penalty} د.ك` : ''}`);
      }

      // 3) العقد يتحول «vacated» — سجل المستأجر ودفعاته وقيوده تبقى محفوظة بالكامل
      const updated = await tx.contract.update({
        where: { id },
        data: {
          status: 'vacated',
          vacatedDate: vacatedDate.toISOString().slice(0, 10),
          ...(refund !== null ? { refund } : {}),
          notes: notesParts.length ? notesParts.join(' — ') : contract.notes,
        },
      });

      // 4) تحرير الوحدة فورًا لتأجيرها لمستأجر جديد
      await syncUnitOccupancy(tx, contract.unitId, 'vacated');

      return { contract: updated, settlementPayment, entryWarning };
    });

    await logAudit(
      user.id, 'update', 'contract', id,
      { vacatedDate: vacatedDate.toISOString().slice(0, 10), refund, penalty, settlement, balance: bal, settlementPaymentId: result.settlementPayment?.id || null },
      `إخلاء فوري وإنهاء عقد — ${contract.tenant?.name || 'مستأجر'} — وحدة ${contract.unit?.number || '؟'}` +
      (result.settlementPayment ? ` + تحصيل تسوية ${settleAmount} د.ك` : (settlement === 'waive' && bal.outstanding > 0 ? ' + إعفاء من المتبقي' : '')),
    );

    return NextResponse.json({
      contract: result.contract,
      balance: bal,
      settleAmount,
      settlementPayment: result.settlementPayment,
      entryWarning: result.entryWarning,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في الإخلاء' }, { status: 400 });
  }
}
