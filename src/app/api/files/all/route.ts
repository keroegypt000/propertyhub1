import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const files = await db.fileUpload.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(files);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}
