import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'journal')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const entries = await db.journalEntry.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(entries);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const entry = await db.journalEntry.create({ data: body });
    await logAudit(user.id, 'create', 'journalEntry', entry.id, body, `إنشاء قيد: ${body.description}`);
    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
