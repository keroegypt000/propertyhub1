import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { readFile, deleteFile } from '@/lib/storage';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const fileRecord = await db.fileUpload.findUnique({ where: { id } });
    if (!fileRecord) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    const buffer = readFile(id);
    if (!buffer) return NextResponse.json({ error: 'الملف غير موجود على القرص' }, { status: 404 });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Length': String(fileRecord.size),
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
    const fileRecord = await db.fileUpload.findUnique({ where: { id } });
    if (!fileRecord) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    await db.fileUpload.delete({ where: { id } });
    deleteFile(id);
    await logAudit(user.id, 'delete', 'file', id, { name: fileRecord.originalName }, `حذف ملف: ${fileRecord.originalName}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
