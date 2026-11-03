import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncLegalCaseEntry, removeAutoEntry } from '@/lib/accounting';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const legalCase = await db.legalCase.findUnique({
      where: { id },
      include: { building: true, unit: true, tenant: true, attachments: true },
    });
    if (!legalCase) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(legalCase);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'legalCases')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.legalCase.findUnique({ where: { id } });
    const legalCase = await db.legalCase.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'legalCase', id, { before: old || undefined, after: body }, `تعديل قضية/مخالفة: ${legalCase.title}`);
    // عند تحويل الحالة إلى "مسددة" يُولد قيد الغرامة — وعند رجوعها يُحذف القيد تلقائيًا
    let entryWarning: string | null = null;
    try {
      const withBuilding = await db.legalCase.findUnique({ where: { id }, include: { building: true } });
      if (withBuilding) await syncLegalCaseEntry(db, withBuilding);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد قيد الغرامة';
    }
    return NextResponse.json({ ...legalCase, entryWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'legalCases')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.legalCase.findUnique({ where: { id } });
    await removeAutoEntry(db, 'legalCase', id);
    await db.legalCase.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'legalCase', id, old || undefined, `حذف قضية/مخالفة: ${old?.title}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
