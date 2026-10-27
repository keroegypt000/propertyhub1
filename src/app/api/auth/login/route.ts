import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSession, sessionCookie, isLocked, recordFail, clearFails } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const lockKey = `${ip}|${String(username || '').toLowerCase()}`;

    if (isLocked(lockKey)) {
      return NextResponse.json({ error: 'محاولات كثيرة — انتظر 10 دقائق' }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { username: String(username || '') } });
    if (!user || !user.active || !verifyPassword(String(password || ''), user.passwordHash, user.salt)) {
      recordFail(lockKey);
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة السر غير صحيحة' }, { status: 401 });
    }

    clearFails(lockKey);
    const token = await createSession(user.id);
    await logAudit(user.id, 'login', 'user', user.id, undefined, 'تسجيل دخول');
    return NextResponse.json({ ok: true, token }, {
      status: 200,
      headers: { 'Set-Cookie': sessionCookie(token) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
