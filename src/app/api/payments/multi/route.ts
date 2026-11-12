import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncPaymentEntry } from '@/lib/accounting';
import { effectiveRent } from '@/lib/calc';
import { nextDocNumber } from '@/lib/numbering';

/**
 * تحصيل جماعي — تسجيل دفعات متعددة لعدة عملاء/عقود في عملية واحدة:
 * - items: [{ contractId, amount, month? }] — مبلغ كل عقد يُدخله المستخدم (يُعبأ تلقائيًا بالمتبقي في الواجهة)
 * - date/method/reference/notes مشتركة لكل الدفعات
 * - كل الدفعات تُنشأ داخل معاملة واحدة: فشل أي دفعة يتراجع الكل
 * - كل دفعة تولّد قيدها المحاسبي (مدين صندوق/بنك — دائن إيراد إيجار)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'payments')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const items: { contractId?: string; amount?: number; month?: string }[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'لم يتم اختيار أي عميل — حدد عميلًا واحدًا على الأقل' }, { status: 400 });

    const method = ['cash', 'transfer', 'check', 'card'].includes(body.method) ? body.method : 'cash';
    const reference = body.reference ? String(body.reference).trim() : null;
    const userNotes = body.notes ? String(body.notes).trim() : '';
    const notes = `دفعة جماعية (${items.length} عميل)${userNotes ? ` — ${userNotes}` : ''}`;
    const date = body.date ? new Date(body.date) : new Date();
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });

    // تحقق من صحة المدخلات قبل لمس قاعدة البيانات
    const ids = items.map(i => String(i.contractId || ''));
    if (ids.some(id => !id)) return NextResponse.json({ error: 'يوجد عنصر بدون عقد' }, { status: 400 });
    for (const it of items) {
      const amount = Number(it.amount);
      if (!amount || amount <= 0) return NextResponse.json({ error: 'يوجد عميل مختار بدون مبلغ صحيح — أكمل المبالغ أو ألغِ تحديده' }, { status: 400 });
    }

    // جلب كل العقود المطلوبة دفعة واحدة
    const contracts = await db.contract.findMany({
      where: { id: { in: ids } },
      include: { tenant: true, unit: true },
    });
    const byId = new Map(contracts.map(c => [c.id, c]));
    const missing = ids.filter(id => !byId.has(id));
    if (missing.length) return NextResponse.json({ error: `عقد غير موجود (${missing.length}) — حدّث الصفحة وأعد المحاولة` }, { status: 400 });

    // تجهيز بيانات الدفعات + تصنيف الحالة (أقل من الإيجار بعد الخصم = جزئية)
    // كل دفعة تأخذ فاتورة (ف) وسند قبض (ق) تسلسليين داخل معاملة الإنشاء الواحدة — الترتيب حسب ترتيب القائمة
    const rows = items.map((it) => {
      const contract = byId.get(String(it.contractId))!;
      const amount = Math.round(Number(it.amount) * 1000) / 1000;
      const status = amount + 0.0005 < effectiveRent(contract as any) ? 'partial' : 'paid';
      return {
        contractId: contract.id,
        amount,
        dueDate: date,
        paidDate: date,
        month: it.month ? String(it.month) : null,
        status,
        method,
        reference,
        notes,
      };
    });

    // إنشاء كل الدفعات في معاملة واحدة — مع إسناد الفاتورة وسند القبض لكل دفعة بالترتيب
    const created = await db.$transaction(async (tdb) => {
      const payments: any[] = [];
      for (const r of rows) {
        payments.push(await tdb.payment.create({ data: {
          ...r,
          invoiceNo: await nextDocNumber(tdb, 'invoice'),
          receiptNo: await nextDocNumber(tdb, 'receipt'),
        } }));
      }
      return payments;
    });

    // توليد القيد المحاسبي لكل دفعة — فشل قيد لا يُسقط الدفعة لكن يُعلن
    const warnings: string[] = [];
    for (const p of created) {
      try { await syncPaymentEntry(db, p); }
      catch (e: any) { warnings.push(e?.message || 'تعذر توليد أحد القيود'); }
    }

    const totalAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 1000) / 1000;
    const names = rows.map((r) => {
      const c = byId.get(r.contractId)!;
      return `${c.tenant?.name || '-'} (${c.unit?.number || '?'})`;
    }).join('، ');
    await logAudit(user.id, 'create', 'payment', created[0]?.id, body,
      `تحصيل جماعي: ${created.length} دفعة بإجمالي ${totalAmount} د.ك — ${names}`);

    return NextResponse.json({ ok: true, count: created.length, totalAmount, partialCount: rows.filter(r => r.status === 'partial').length, entryWarnings: warnings.length ? warnings : undefined }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
