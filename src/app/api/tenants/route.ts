import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        uploads: {
          select: {
            id: true, filename: true, originalName: true, mimeType: true, size: true,
            category: true, tenantId: true, uploadedBy: true, createdAt: true,
          },
        },
      },
    });
    return NextResponse.json(tenants);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'tenants')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const tenant = await db.tenant.create({ data: body });
    await logAudit(user.id, 'create', 'tenant', tenant.id, body, `إنشاء مستأجر: ${body.name}`);
    return NextResponse.json(tenant, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
