import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, hashPassword, ROLES } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, name: true, role: true, permissions: true, active: true, createdAt: true },
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await authMiddleware(request);
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }
    const body = await request.json();
    const { username, name, password, role } = body;

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username || '')) {
      return NextResponse.json({ error: 'اسم المستخدم غير صالح' }, { status: 400 });
    }
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: 'كلمة السر 8 أحرف على الأقل' }, { status: 400 });
    }
    if (!ROLES[role]) {
      return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 });
    }
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'اسم المستخدم مستخدم بالفعل' }, { status: 400 });
    }

    const { hash, salt } = hashPassword(String(password));

    const newUser = await db.user.create({
      data: { username, name: String(name).trim(), passwordHash: hash, salt, role, active: true },
    });

    await logAudit(currentUser.id, 'create', 'user', newUser.id, { username, role }, `إنشاء مستخدم: ${username} (${ROLES[role]})`);
    return NextResponse.json({ id: newUser.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
