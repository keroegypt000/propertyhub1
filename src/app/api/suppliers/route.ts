import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** الموردين والمقاولين — قائمة بكل مورد مع ملخص دفعاته */
export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const suppliers = await db.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: { payments: { orderBy: { date: 'desc' } } },
    });
    return NextResponse.json(suppliers);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'اسم المورد / المقاول مطلوب' }, { status: 400 });
    const supplier = await db.supplier.create({
      data: {
        name,
        type: ['contractor', 'supplier'].includes(body.type) ? body.type : 'contractor',
        phone: body.phone ? String(body.phone).trim() : null,
        specialty: body.specialty ? String(body.specialty).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });
    await logAudit(user.id, 'create', 'supplier', supplier.id, body, `إضافة ${supplier.type === 'contractor' ? 'مقاول' : 'مورد'}: ${name}`);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
