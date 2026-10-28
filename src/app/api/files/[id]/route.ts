import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canRead, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { downloadFromStorage, deleteFromStorage } from '@/lib/storage';

// تحميل/معاينة الملف — يمر دائماً عبر المصادقة (لا روابط عامة دائمة للمستندات الخاصة)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    if (!canRead('viewer', 'files')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const fileRecord = await db.fileUpload.findUnique({ where: { id } });
    if (!fileRecord) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    let buffer: Buffer | null = null;

    if (fileRecord.storageProvider === 'r2' && fileRecord.storageKey) {
      // ملف سحابي: تحميل من R2 عبر الخادم (المفاتيح السرية على السيرفر فقط)
      buffer = await downloadFromStorage(fileRecord.storageKey);
      if (!buffer) return NextResponse.json({ error: 'الملف غير متوفر في التخزين السحابي' }, { status: 404 });
    } else if (fileRecord.data) {
      // ملف قديم: المحتوى داخل قاعدة البيانات
      buffer = Buffer.from(fileRecord.data);
    } else {
      return NextResponse.json({ error: 'محتوى الملف غير موجود' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'files')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const fileRecord = await db.fileUpload.findUnique({
      where: { id },
      select: { id: true, originalName: true, storageProvider: true, storageKey: true },
    });
    if (!fileRecord) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    await db.fileUpload.delete({ where: { id } });
    // حذف الكائن من التخزين السحابي بعد نجاح حذف السجل (لا يمنع الاستجابة عند فشله)
    if (fileRecord.storageProvider === 'r2' && fileRecord.storageKey) {
      await deleteFromStorage(fileRecord.storageKey);
    }
    await logAudit(user.id, 'delete', 'file', id, { name: fileRecord.originalName }, `حذف ملف: ${fileRecord.originalName}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
