import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const contracts = await db.contract.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        unit: { include: { building: true } }, tenant: true, payments: true,
        attachments: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, contractId: true, uploadedBy: true, createdAt: true,
          },
        },
      },
    });
    return NextResponse.json(contracts);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'contracts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const contract = await db.contract.create({ data: body });
    await logAudit(user.id, 'create', 'contract', contract.id, body, `إنشاء عقد`);
    return NextResponse.json(contract, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
