import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSession, sessionCookie } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const userCount = await db.user.count();
    if (userCount > 0) {
      return NextResponse.json({ error: 'تم الإعداد مسبقًا' }, { status: 403 });
    }
    const body = await request.json();
    const { username, name, password } = body;
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username || '')) {
      return NextResponse.json({ error: 'اسم المستخدم غير صالح (3-30 حرف)' }, { status: 400 });
    }
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: 'كلمة السر يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
    }
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }
    const { hash, salt } = hashPassword(String(password));
    const user = await db.user.create({
      data: {
        username: String(username).trim(),
        name: String(name).trim(),
        passwordHash: hash,
        salt,
        role: 'admin',
        active: true,
      },
    });
    const token = await createSession(user.id);
    await logAudit(user.id, 'create', 'user', user.id, undefined, 'إعداد الحساب الأول');
    return NextResponse.json({ ok: true, token }, {
      status: 200,
      headers: { 'Set-Cookie': sessionCookie(token) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
