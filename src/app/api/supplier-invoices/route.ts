import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { upsertAutoEntry, syncSupplierInvoiceEntry, ACC } from '@/lib/accounting';
import { nextDocNumber } from '@/lib/numbering';

/**
 * مستحقات الموردين والمقاولين (م-0001) — فاتورة شغلانة/توريد مستحقة على عمارة
 * كل مستحق يولّد قيدًا محاسبيًا: مدين حساب المصروف / دائن 2101 الذمم الدائنة — الموردون
 * الدفعات المرتبطة به تسدّده على دفعات وتقيد على حساب المورد 2101 — فلا يتكرر المصروف
 */
/** خطأ المصادقة فقط يرجع 401 — أخطاء قاعدة البيانات ترجع 500 بالرسالة الحقيقية */
function routeError(error: any) {
  if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  console.error('[supplier-invoices GET]', error?.message || error);
  return NextResponse.json({ error: `تعذر تحميل مستحقات الموردين: ${error?.message || 'خطأ في قاعدة البيانات'}` }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const invoices = await db.supplierInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        building: true,
        unit: true,
        payments: { orderBy: { date: 'desc' } },
      },
    });
    return NextResponse.json(invoices);
  } catch (error: any) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const supplierId = String(body.supplierId || '');
    if (!supplierId) return NextResponse.json({ error: 'المورد مطلوب' }, { status: 400 });
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 400 });
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    const date = String(body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (isNaN(new Date(date).getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });
    const accountCode = String(body.accountCode || ACC.MAINTENANCE);

    // مستحق المورد = مستند تسلسلي (م) من العدّاد المركزي — داخل معاملة الإنشاء
    const invoice = await db.$transaction(async (tdb) => tdb.supplierInvoice.create({
      data: {
        supplierId,
        buildingId: body.buildingId || null,
        unitId: body.unitId || null,
        amount: Math.round(amount * 1000) / 1000,
        date,
        dueDate: body.dueDate ? String(body.dueDate).slice(0, 10) : null,
        description: body.description ? String(body.description).trim() : null,
        accountCode,
        notes: body.notes ? String(body.notes).trim() : null,
        invoiceNo: await nextDocNumber(tdb, 'supplierInvoice'),
      },
    }));

    // القيد المحاسبي: مدين حساب المصروف / دائن 2101 الذمم الدائنة — الموردون
    let entryWarning: string | null = null;
    try {
      await syncSupplierInvoiceEntry(db, invoice);
    } catch (e: any) {
      entryWarning = e?.message || 'تعذر توليد القيد المحاسبي';
      console.error('[supplier-invoice POST entry]', entryWarning);
    }

    await logAudit(user.id, 'create', 'supplierInvoice', invoice.id, body, `مستحق ${invoice.amount} د.ك على ${supplier.name}${invoice.invoiceNo ? ` (${invoice.invoiceNo})` : ''}`);
    return NextResponse.json({ ...invoice, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
