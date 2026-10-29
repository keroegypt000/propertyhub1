import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite, canRead } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseLines, ensureAccounts, isBalanced, JournalLine } from '@/lib/accounting';

// تجهيز سطور القيد: يقبل accountId (من الفورم) أو accountCode،
// يجلب الكود والاسم من شجرة الحسابات، ويتأكد أن القيد متوازن
async function normalizeLines(raw: any): Promise<JournalLine[]> {
  const input = parseLines(raw);
  if (!input.length) throw new Error('القيد يجب أن يحتوي على سطر واحد على الأقل');
  // جلب بيانات الحسابات المُشار إليها بالمعرّف
  const ids = input.map(l => l.accountId).filter((x): x is string => !!x);
  const byId = new Map<string, { id: string; code: string; name: string }>();
  if (ids.length) {
    const accounts = await db.account.findMany({ where: { id: { in: ids } } });
    for (const a of accounts) byId.set(a.id, { id: a.id, code: a.code, name: a.name });
  }
  const lines: JournalLine[] = input.map(l => {
    const acc = l.accountId ? byId.get(l.accountId) : undefined;
    return {
      accountId: acc?.id || null,
      accountCode: acc?.code || String(l.accountCode || ''),
      accountName: acc?.name || String(l.accountName || l.accountCode || ''),
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    };
  });
  if (lines.some(l => !l.accountCode)) throw new Error('كل سطر يجب أن يحدد حسابًا موجودًا');
  if (!isBalanced(lines.map(l => ({ accountCode: l.accountCode, debit: l.debit, credit: l.credit })))) {
    throw new Error('القيد غير متوازن — مجموع المدين يجب أن يساوي مجموع الدائن');
  }
  return lines;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canRead(user.role, 'journal')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    const entries = await db.journalEntry.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    // buildingId بلا علاقة Prisma — نحضر أسماء المباني ونضمّنها يدويًا للعرض
    const buildings = await db.building.findMany({ select: { id: true, name: true } });
    const bmap: Record<string, { name: string }> = {};
    for (const b of buildings) bmap[b.id] = { name: b.name };
    return NextResponse.json(entries.map(e => ({
      ...e,
      building: e.buildingId ? (bmap[e.buildingId] || undefined) : undefined,
      lines: parseLines(e.lines),
    })));
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();
    const lines = await normalizeLines(body.lines);
    const entry = await db.journalEntry.create({
      data: {
        date: body.date || new Date().toISOString().slice(0, 10),
        description: body.description || 'قيد يومي',
        buildingId: body.buildingId || null,
        lines: JSON.stringify(lines),
        source: 'manual',
      },
    });
    await logAudit(user.id, 'create', 'journalEntry', entry.id, body, `إنشاء قيد: ${body.description}`);
    return NextResponse.json({ ...entry, lines }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
