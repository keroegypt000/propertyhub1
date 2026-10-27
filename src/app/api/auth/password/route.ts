import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!verifyPassword(String(oldPassword || ''), user.passwordHash, user.salt)) {
      return NextResponse.json({ error: 'كلمة السر الحالية غير صحيحة' }, { status: 400 });
    }
    if (!newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ error: 'كلمة السر الجديدة 8 أحرف على الأقل' }, { status: 400 });
    }

    const { hash, salt } = hashPassword(String(newPassword));
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hash, salt } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 401 });
  }
}
