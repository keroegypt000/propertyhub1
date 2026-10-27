import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, getSessionToken, sessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (token) await deleteSession(token);
  return NextResponse.json({ ok: true }, {
    headers: { 'Set-Cookie': sessionCookie('', 0) },
  });
}
