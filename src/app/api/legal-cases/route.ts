import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncLegalCaseEntry } from '@/lib/accounting';

// الحقول المسموح بها فقط
function cleanBody(body: any) {
  return {
    title: String(body.title || '').trim(),
    type: body.type !== undefined ? String(body.type) : undefined, // municipal | lawsuit | other
    reference: body.reference !== undefined ? (body.reference ? String(body.reference).trim() : null) : undefined,
    buildingId: body.buildingId !== undefined ? (body.buildingId || null) : undefined,
    unitId: body.unitId !== undefined ? (body.unitId || null) : undefined,
    tenantId: body.tenantId !== undefined ? (body.tenantId || null) : undefined,
    status: body.status !== undefined ? String(body.status) : undefined, // open | in_progress | paid | closed
    filedDate: body.filedDate !== undefined ? (body.filedDate || null) : undefined,
    hearingDate: body.hearingDate !== undefined ? (body.hearingDate || null) : undefined,
    amount: body.amount !== undefined ? (body.amount ? Number(body.amount) : null) : undefined,
    description: body.description !== undefined ? (body.description || null) : undefined,
    notes: body.notes !== undefined ? (body.notes || null) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'legalCases')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const cases = await db.legalCase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        building: true,
        unit: true,
        tenant: true,
        attachments: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, legalCaseId: true, uploadedBy: true, createdAt: true,
          },
        },
      },
    });
    return NextResponse.json(cases);
  } catch (error: any) {
    if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: error.message || 'خطأ في تحميل القضايا' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'legalCases')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const data = cleanBody(body);
    if (!data.title) return NextResponse.json({ error: 'عنوان المخالفة/القضية مطلوب' }, { status: 400 });

    const legalCase = await db.legalCase.create({ data });
    await logAudit(user.id, 'create', 'legalCase', legalCase.id, body, `إنشاء ${legalCase.type === 'lawsuit' ? 'قضية' : 'مخالفة'}: ${legalCase.title}`);

    // الغرامة المسددة فورًا تولد قيدها المحاسبي (مدين 5208 / دائن الصندوق)
    let entryWarning: string | null = null;
    try {
      const withBuilding = await db.legalCase.findUnique({ where: { id: legalCase.id }, include: { building: true } });
      if (withBuilding) await syncLegalCaseEntry(db, withBuilding);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر توليد قيد الغرامة';
    }
    return NextResponse.json({ ...legalCase, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
