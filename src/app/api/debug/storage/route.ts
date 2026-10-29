import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';
import { db } from '@/lib/db';
import { r2Configured } from '@/lib/storage';
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// =============================================================
// أداة تشخيص التخزين السحابي — للمدير فقط (GET)
// تُظهر: حالة متغيرات R2 (مقنّعة)، عدد الملفات المخزنة في قاعدة البيانات (وضع fallback)،
// ونتيجة اختبار حقيقي List/Put/Delete من داخل بيئة النشر نفسها — لتحديد السبب الفعلي لفشل R2
// الاستخدام: افتح /api/debug/storage وأنت مسجل دخول كمدير، ثم أرسل الرد JSON للمطور
// =============================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Step = { step: string; ok: boolean; detail?: string; error?: string };

function varInfo(name: string, previewChars: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.length === 0) return { present: false };
  const trimmed = raw.trim();
  return {
    present: true,
    length: raw.length,
    hasExtraSpaces: raw !== trimmed, // مسافات في البداية/النهاية — سبب شائع لفشل التوقيع
    preview: previewChars ? `${trimmed.slice(0, previewChars)}…` : '(سري — لا يُعرض)',
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'هذه الأداة للمدير فقط' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'غير مصرح — سجل دخول كمدير أولاً' }, { status: 401 });
  }

  // 1) حالة المتغيرات (بدون كشف الأسرار)
  const env = {
    R2_ACCOUNT_ID: varInfo('R2_ACCOUNT_ID', 6),
    R2_ACCESS_KEY_ID: varInfo('R2_ACCESS_KEY_ID', 6),
    R2_SECRET_ACCESS_KEY: varInfo('R2_SECRET_ACCESS_KEY', 0),
    R2_BUCKET: varInfo('R2_BUCKET', 20),
  };

  // 2) كم ملف محفوظ داخل قاعدة البيانات (وضع fallback) وحجمها الإجمالي
  let dbFiles: { count: number; totalBytes: number } | { error: string };
  try {
    const agg = await db.fileUpload.aggregate({
      where: { storageProvider: 'db', data: { not: null } },
      _count: { _all: true },
      _sum: { size: true },
    });
    dbFiles = { count: agg._count._all, totalBytes: agg._sum.size ?? 0 };
  } catch (e: any) {
    dbFiles = { error: e?.message || 'فشل استعلام قاعدة البيانات' };
  }

  const steps: Step[] = [];

  // 3) المتغيرات غير مكتملة → الرفع يذهب للقاعدة بصمت (بدون حتى رسالة تحذير)
  if (!r2Configured()) {
    return NextResponse.json({
      configured: false,
      env,
      dbFiles,
      steps,
      verdict:
        'أحد متغيرات R2 غير موجود في هذا النشر — لذلك الرفع يذهب لقاعدة البيانات تلقائياً وبصمت. الحل: أضف المتغيرات الأربعة في Vercel (Production) ثم أعد النشر، وارجع لهذه الصفحة.',
    });
  }

  // 4) اختبار حقيقي من داخل بيئة النشر (بقيم منقّحة من المسافات)
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
  const bucket = process.env.R2_BUCKET!.trim();
  const testKey = `_diagnostic/test-${Date.now()}.txt`;

  try {
    const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    steps.push({ step: 'ListObjectsV2', ok: true, detail: `البكت مستجيب — الكائنات في أول صفحة: ${list.KeyCount ?? 0}` });
  } catch (e: any) {
    steps.push({ step: 'ListObjectsV2', ok: false, error: `${e?.name || 'Error'}: ${e?.message || e}` });
  }

  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: testKey, Body: Buffer.from('PH', 'utf8'), ContentType: 'text/plain' }));
    steps.push({ step: 'PutObject', ok: true, detail: `رُفع ملف اختباري: ${testKey}` });
  } catch (e: any) {
    steps.push({ step: 'PutObject', ok: false, error: `${e?.name || 'Error'}: ${e?.message || e}` });
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    steps.push({ step: 'DeleteObject', ok: true, detail: 'حُذف ملف الاختبار (تنظيف)' });
  } catch (e: any) {
    steps.push({ step: 'DeleteObject', ok: false, error: `${e?.name || 'Error'}: ${e?.message || e}` });
  }

  const allOk = steps.every((s) => s.ok);
  const verdict = allOk
    ? 'R2 يعمل من داخل النشر ✅ — إذا كان الرفع لا يزال يذهب للقاعدة فجرّب رفع ملف جديد الآن، ثم استدعِ /api/files/migrate-to-r2 لنقل الملفات القديمة من قاعدة البيانات إلى R2.'
    : 'R2 فاشل من داخل النشر — الخطأ أعلاه هو السبب الحقيقي. أرسل هذا الرد كاملاً للمطور.';

  return NextResponse.json({ configured: true, env, dbFiles, steps, verdict });
}
