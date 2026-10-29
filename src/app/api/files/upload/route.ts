import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  detectMimeType, SUPPORTED_TYPES, MAX_FILE_SIZE, generateFileId,
  r2Configured, uploadToStorage, buildStorageKey, cleanupOrphan,
} from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'files')) {
      return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    }

    const filename = request.headers.get('X-Filename');
    const category = request.headers.get('X-Category') || 'general';
    const contractId = request.headers.get('X-Contract-Id') || undefined;
    const tenantId = request.headers.get('X-Tenant-Id') || undefined;
    const maintenanceId = request.headers.get('X-Maintenance-Id') || undefined;

    if (!filename) {
      return NextResponse.json({ error: 'اسم الملف مطلوب' }, { status: 400 });
    }
    // التحقق من صحة معرفات الربط (منع الربط بمعرفات غير موجودة)
    if (contractId && !(await db.contract.findUnique({ where: { id: contractId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'العقد المحدد غير موجود' }, { status: 400 });
    }
    if (tenantId && !(await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'المستأجر المحدد غير موجود' }, { status: 400 });
    }
    if (maintenanceId && !(await db.maintenanceRequest.findUnique({ where: { id: maintenanceId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'طلب الصيانة المحدد غير موجود' }, { status: 400 });
    }

    const body = await request.arrayBuffer();
    const buffer = Buffer.from(body);

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `حجم الملف يتخطى الحد الأقصى (${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 413 });
    }
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    const mimeType = detectMimeType(buffer) || 'application/octet-stream';
    if (!SUPPORTED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم (المسموح: صور JPG/PNG/WebP/GIF أو PDF)' }, { status: 400 });
    }

    const id = generateFileId();
    const originalName = decodeURIComponent(filename);

    // التخزين السحابي عند توفر الإعداد — وإلا الوضع القديم (المحتوى في قاعدة البيانات)
    let storageProvider = 'db';
    let storageKey: string | null = null;
    let data: Buffer | null = buffer;
    let warning: string | null = null;

    if (r2Configured()) {
      storageKey = buildStorageKey(id, originalName);
      try {
        await uploadToStorage(buffer, storageKey, mimeType);
        storageProvider = 'r2';
        data = null; // الميتاداتا فقط في قاعدة البيانات — لا محتوى ثنائي
      } catch (r2Error: any) {
        // فشل السحابة لا يضيع الملف: يُحفظ في قاعدة البيانات + يُبلغ المستخدم بالسبب الحقيقي
        console.error('[files/upload] R2 storage failed, DB fallback:', r2Error?.name, '-', r2Error?.message);
        storageKey = null;
        warning = `الملف محفوظ في قاعدة البيانات — فشل التخزين السحابي: ${r2Error?.message || 'خطأ غير معروف'}`;
      }
    }

    let fileRecord;
    try {
      fileRecord = await db.fileUpload.create({
        data: {
          id,
          filename: id,
          originalName,
          mimeType,
          size: buffer.length,
          data,
          storageProvider,
          storageKey,
          category,
          contractId: contractId || null,
          tenantId: tenantId || null,
          maintenanceId: maintenanceId || null,
          uploadedBy: user.id,
        },
      });
    } catch (dbError) {
      // فشل قاعدة البيانات بعد رفع ناجح — تنظيف الملف اليتيم من السحابة
      if (storageKey) await cleanupOrphan(storageKey);
      throw dbError;
    }

    await logAudit(user.id, 'upload', 'file', id, { name: originalName, category, size: buffer.length, provider: storageProvider }, `رفع ملف: ${originalName}`);

    const { data: _data, ...fileMeta } = fileRecord;
    return NextResponse.json({ ...fileMeta, warning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في رفع الملف' }, { status: 400 });
  }
}
