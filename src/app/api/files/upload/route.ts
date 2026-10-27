import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { saveFile, detectMimeType, SUPPORTED_TYPES, MAX_FILE_SIZE, generateFileId } from '@/lib/storage';

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

    const body = await request.arrayBuffer();
    const buffer = Buffer.from(body);

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `حجم الملف يتخطى الحد الأقصى (${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 413 });
    }

    const mimeType = detectMimeType(buffer) || 'application/octet-stream';
    if (!SUPPORTED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });
    }

    const id = generateFileId();
    saveFile(buffer, id);

    const originalName = decodeURIComponent(filename);
    const fileRecord = await db.fileUpload.create({
      data: {
        id,
        filename: id,
        originalName,
        mimeType,
        size: buffer.length,
        category,
        contractId: contractId || null,
        tenantId: tenantId || null,
        maintenanceId: maintenanceId || null,
        uploadedBy: user.id,
      },
    });

    await logAudit(user.id, 'upload', 'file', id, { name: originalName, category, size: buffer.length }, `رفع ملف: ${originalName}`);

    return NextResponse.json(fileRecord, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في رفع الملف' }, { status: 400 });
  }
}
