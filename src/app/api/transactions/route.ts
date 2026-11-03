import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncTransactionEntry } from '@/lib/accounting';

// الحقول المسموح بها فقط — يمنع تمرير حقول دخيلة إلى Prisma
function cleanBody(body: any) {
  return {
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    buildingId: body.buildingId || null,
    type: body.type === 'income' ? 'income' : 'expense',
    category: String(body.category || '').trim(),
    amount: Number(body.amount) || 0,
    account: body.account ? String(body.account).trim() : null,
    cashAccount: body.cashAccount ? String(body.cashAccount) : 'cash',
  };
}

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

    // ======== المصروف الإداري المشترك: توزيع على كل العمارات ========
    // distribute: { mode: 'equal' | 'rent' } — يُنشئ حركة مستقلة لكل عمارة بحصتها
    // كل حصة تولّد قيدًا مزدوجًا مرتبطًا بالعمارة فيظهر في تقريرها المحاسبي
    if (body.distribute && body.type === 'expense') {
      const mode = body.distribute?.mode === 'rent' ? 'rent' : 'equal';
      const buildings = await db.building.findMany({ include: { units: true } });
      if (!buildings.length) return NextResponse.json({ error: 'لا توجد عمارات للتوزيع' }, { status: 400 });

      // أوزان التوزيع: بالتساوي أو بنسبة الإيجار المتوقع (مجموع إيجار وحدات العمارة)
      const weights = buildings.map((b) => {
        if (mode === 'equal') return 1;
        const rent = b.units.reduce((s, u) => s + (u.rentAmount || 0), 0);
        return rent > 0 ? rent : 1; // عمارة بلا إيجارات مسجل تاخد وزن 1 حتى لا تُحرم من التوزيع
      });
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      const totalAmount = Number(body.amount) || 0;
      if (totalAmount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });

      // الحصص: التقريب للفلس (3 خانات) — الفرق المتبقي من التقريب يُضاف لآخر عمارة
      const shares = weights.map((w) => Math.round((totalAmount * w / totalWeight) * 1000) / 1000);
      const diff = Math.round((totalAmount - shares.reduce((s, x) => s + x, 0)) * 1000) / 1000;
      shares[shares.length - 1] = Math.round((shares[shares.length - 1] + diff) * 1000) / 1000;

      const created: any[] = [];
      const warnings: string[] = [];
      for (let i = 0; i < buildings.length; i++) {
        const data = cleanBody({
          ...body,
          buildingId: buildings[i].id,
          amount: shares[i],
          category: body.category ? `${body.category} (موزعة)` : 'مصروف إداري موزع',
        });
        const tx = await db.transaction.create({ data });
        try { await syncTransactionEntry(db, tx); } catch (e: any) { warnings.push(`${buildings[i].name}: ${e.message}`); }
        created.push(tx);
      }
      await logAudit(user.id, 'create', 'transaction', created[0]?.id, body,
        `مصروف إداري موزع على ${created.length} عمارة (${mode === 'rent' ? 'بنسبة الإيجار' : 'بالتساوي'}): ${body.category} — إجمالي ${totalAmount}`);
      return NextResponse.json({
        distributed: true, count: created.length,
        items: created.map((t, i) => ({ buildingId: t.buildingId, buildingName: buildings[i].name, amount: t.amount })),
        warnings: warnings.length ? warnings : undefined,
      }, { status: 201 });
    }

    // ======== حركة عادية (إيراد أو مصروف) ========
    const data = cleanBody(body);
    if (!data.category) return NextResponse.json({ error: 'البيان مطلوب' }, { status: 400 });
    if (data.amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    if (data.buildingId && !(await db.building.findUnique({ where: { id: data.buildingId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'العمارة غير موجودة' }, { status: 400 });
    }
    const transaction = await db.transaction.create({ data });
    await logAudit(user.id, 'create', 'transaction', transaction.id, body, `إنشاء معاملة: ${data.category}`);

    // توليد القيد المزدوج تلقائيًا (مدين ودائن) مرتبطًا بالعمارة — فشل القيد لا يُسقط الحركة
    let entryWarning: string | null = null;
    try { await syncTransactionEntry(db, transaction); }
    catch (entryErr: any) { entryWarning = entryErr?.message || 'تعذر توليد القيد المحاسبي'; console.error('[transactions POST entry]', entryWarning); }

    return NextResponse.json({ ...transaction, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
