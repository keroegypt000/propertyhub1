import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_ACCOUNTS } from '@/lib/defaultAccounts';

// استيراد الشجرة الافتراضية — آمن للتكرار (idempotent):
// - يتحقق من الأكواد الموجودة ويستبعدها (لا يعدّل حساباً عليه قيود)
// - ينشئ الآباء قبل الأبناء داخل معاملة واحدة
// - يُرجع تقرير: المنشأ / المتخطى
export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'accounts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });

    const existing = await db.account.findMany({ select: { code: true, name: true } });
    const existingByCode = new Map(existing.map(a => [a.code, a]));

    let created = 0;
    const skipped: string[] = [];
    const codeToId = new Map<string, string>();
    for (const a of existing) codeToId.set(a.code, a.id);

    // خطة الإنشاء: الآباء قبل الأبناء (المصفوفة مرتبة مسبقاً)
    const toCreate = DEFAULT_ACCOUNTS.filter(a => !existingByCode.has(a.code));

    // تحقق مسبق: كل أب مشار إليه موجود (في الموجود أو في الخطة)
    const plannedCodes = new Set(toCreate.map(a => a.code));
    for (const a of toCreate) {
      if (a.parentCode && !existingByCode.has(a.parentCode) && !plannedCodes.has(a.parentCode)) {
        return NextResponse.json({ error: `خطأ في الشجرة: الحساب ${a.code} يشير لأب غير موجود (${a.parentCode})` }, { status: 500 });
      }
    }

    await db.$transaction(async (tx) => {
      for (const a of toCreate) {
        const rec = await tx.account.create({
          data: {
            code: a.code,
            name: a.name,
            type: a.type,
            kind: a.kind,
            parent: a.parentCode ? (codeToId.get(a.parentCode) || null) : null,
          },
        });
        codeToId.set(a.code, rec.id);
        created++;
      }
    });

    for (const a of DEFAULT_ACCOUNTS) {
      if (existingByCode.has(a.code)) skipped.push(`${a.code} - ${a.name}`);
    }

    await logAudit(user.id, 'create', 'account', 'seed', { created, skipped: skipped.length },
      `استيراد الشجرة الافتراضية: ${created} حساب جديد، ${skipped.length} موجود مسبقاً`);

    return NextResponse.json({ ok: true, created, skipped, total: DEFAULT_ACCOUNTS.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في الاستيراد' }, { status: 500 });
  }
}
