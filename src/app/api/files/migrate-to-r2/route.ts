import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';
import { db } from '@/lib/db';
import { r2Configured, uploadToStorage, buildStorageKey } from '@/lib/storage';
import { logAudit } from '@/lib/audit';

// =============================================================
// ترحيل الملفات من قاعدة البيانات إلى التخزين السحابي R2 — للمدير فقط (POST)
// يُستدعى بعد إصلاح إعدادات R2 لنقل الملفات التي حُفظت في القاعدة أثناء فشل السحابة
// - دفعات محدودة العدد (limit افتراضي 30) لتجنب تجاوز مهلة الدوال — آمن للاستدعاء المتكرر حتى remaining = 0
// - كل ملف: رفع إلى R2 → تحقق HeadObject → تحديث السجل (storageProvider=r2 + تفريغ المحتوى data=null)
// - فشل ملف لا يوقف الدفعة: يُسجل في failed ويستمر الباقي
// الاستخدام: افتح /api/files/migrate-to-r2 بأي أداة POST (أو من المتصفح عبر زر) وأنت مدير
// =============================================================

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await authMiddleware(request);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'الترحيل للمدير فقط' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'غير مصرح — سجل دخول كمدير أولاً' }, { status: 401 });
  }

  if (!r2Configured()) {
    return NextResponse.json(
      { error: 'التخزين السحابي غير مهيأ في هذا النشر — راجع /api/debug/storage أولاً' },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100);

  const files = await db.fileUpload.findMany({
    where: { storageProvider: 'db', data: { not: null } },
    select: { id: true, originalName: true, mimeType: true, size: true, data: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  if (files.length === 0) {
    return NextResponse.json({ processed: 0, migrated: [], failed: [], remaining: 0, note: 'لا توجد ملفات في قاعدة البيانات — كل شيء على السحابة ✅' });
  }

  const migrated: string[] = [];
  const failed: { id: string; name: string; error: string }[] = [];

  for (const f of files) {
    try {
      const key = buildStorageKey(f.id, f.originalName);
      await uploadToStorage(Buffer.from(f.data as unknown as Uint8Array), key, f.mimeType);
      await db.fileUpload.update({
        where: { id: f.id },
        data: { storageProvider: 'r2', storageKey: key, data: null },
      });
      migrated.push(`${f.originalName} (${(f.size / 1024).toFixed(0)}KB)`);
    } catch (e: any) {
      failed.push({ id: f.id, name: f.originalName, error: `${e?.name || 'Error'}: ${e?.message || e}` });
    }
  }

  const remaining = await db.fileUpload.count({ where: { storageProvider: 'db', data: { not: null } } });
  await logAudit(user.id, 'update', 'file', undefined, { migrated: migrated.length, failed: failed.length }, `ترحيل ملفات من قاعدة البيانات إلى R2`);

  return NextResponse.json({
    processed: files.length,
    migrated,
    failed,
    remaining,
    note: remaining > 0 ? `بقيت ${remaining} ملف — استدعِ الرابط مرة أخرى لنقل الدفعة التالية` : 'تم نقل كل الملفات إلى R2 ✅ — قاعدة البيانات أصبحت خفيفة',
  });
}
