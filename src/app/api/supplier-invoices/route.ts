import { NextRequest, NextResponse } from 'next/server';
import { db, withDbRetry, ValidationError } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncSupplierInvoiceEntry, ACC } from '@/lib/accounting';
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
    const invoices = await withDbRetry(() => db.supplierInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        building: true,
        unit: true,
        payments: { orderBy: { date: 'desc' } },
      },
    }));
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
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    const date = String(body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (isNaN(new Date(date).getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });
    const accountCode = String(body.accountCode || ACC.MAINTENANCE);

    // العملية كلها داخل معاملة واحدة (اتصال واحد): التحقق + الإنشاء + الترقيم + القيد المحاسبي + سجل التدقيق
    // يقلل ضغط اتصالات قاعدة البيانات في الإنتاج ويضمن الذرية — لا مستحق بلا قيد ولا قيد بلا مستحق
    // مع إعادة المحاولة تلقائيًا عند أخطاء الاتصالات المؤقتة (ضغط الاتصالات في Supabase)
    const invoice = await withDbRetry(() => db.$transaction(async (tdb) => {
      const supplier = await tdb.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new ValidationError('المورد غير موجود');
      const inv = await tdb.supplierInvoice.create({
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
      });
      // القيد المحاسبي: مدين حساب المصروف / دائن 2101 الذمم الدائنة — الموردون — داخل نفس المعاملة
      await syncSupplierInvoiceEntry(tdb, { ...inv, supplier });
      await logAudit(user.id, 'create', 'supplierInvoice', inv.id, body, `مستحق ${inv.amount} د.ك على ${supplier.name}${inv.invoiceNo ? ` (${inv.invoiceNo})` : ''}`, tdb);
      return inv;
    }));

    return NextResponse.json({ ...invoice, entryWarning: null }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[supplier-invoices POST]', error?.message || error);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}
