import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const entity = url.searchParams.get('entity') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const userId = url.searchParams.get('userId') || undefined;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, username: true } } },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}
