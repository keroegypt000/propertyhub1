import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, ROLES } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleName: ROLES[user.role] || user.role,
      permissions: user.permissions || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}
