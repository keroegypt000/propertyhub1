import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { duplicateNameError } from '@/lib/unique';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'accounts')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const accounts = await db.account.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'accounts')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'رقم الحساب مطلوب' }, { status: 400 });
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'اسم الحساب مطلوب' }, { status: 400 });
    // منع التكرار — رقم الحساب فريد (قيد قاعدة البيانات) واسم الحساب لا يتكرر
    const codeTaken = await db.account.findUnique({ where: { code } });
    if (codeTaken) return NextResponse.json({ error: `رقم الحساب «${code}» مستخدم بالفعل لحساب «${codeTaken.name}»` }, { status: 400 });
    const all = await db.account.findMany({ select: { id: true, name: true } });
    const dup = duplicateNameError(all, name, { field: 'اسم الحساب' });
    if (dup) return NextResponse.json({ error: dup }, { status: 400 });
    const account = await db.account.create({ data: { ...body, code, name } });
    await logAudit(user.id, 'create', 'account', account.id, body, `إنشاء حساب: ${body.name}`);
    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
