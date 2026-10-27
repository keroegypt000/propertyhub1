import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, ROLES, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await authMiddleware(request);
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'للمدير فقط' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    // Managers cannot modify admin users
    if (currentUser.role === 'manager' && target.role === 'admin') {
      return NextResponse.json({ error: 'لا يمكن تعديل مدير النظام' }, { status: 403 });
    }
    // Managers cannot promote anyone to admin
    if (currentUser.role === 'manager' && body.role === 'admin') {
      return NextResponse.json({ error: 'لا يمكن ترقية لمدير النظام' }, { status: 403 });
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (!ROLES[body.role]) return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 });
      // Prevent removing last admin
      if (target.role === 'admin' && body.role !== 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin', active: true } });
        if (adminCount <= 1) return NextResponse.json({ error: 'لا يمكن إزالة آخر مدير' }, { status: 400 });
      }
      updateData.role = body.role;
    }
    if (body.active !== undefined) {
      if (!body.active && target.role === 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin', active: true } });
        if (adminCount <= 1) return NextResponse.json({ error: 'لا يمكن تعطيل آخر مدير' }, { status: 400 });
      }
      updateData.active = !!body.active;
    }
    if (body.password) {
      if (String(body.password).length < 8) return NextResponse.json({ error: 'كلمة السر 8 أحرف على الأقل' }, { status: 400 });
      const { hash, salt } = hashPassword(String(body.password));
      updateData.passwordHash = hash;
      updateData.salt = salt;
    }
    if (body.permissions !== undefined) {
      updateData.permissions = body.permissions;
    }

    await db.user.update({ where: { id }, data: updateData });

    // Invalidate sessions if deactivated or password changed
    if (!body.active || body.password) {
      await db.session.deleteMany({ where: { userId: id } });
    }

    await logAudit(currentUser.id, 'update', 'user', id, updateData, `تعديل مستخدم: ${target.username}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
