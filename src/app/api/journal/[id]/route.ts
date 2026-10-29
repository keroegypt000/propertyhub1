import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseLines, isBalanced, JournalLine } from '@/lib/accounting';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const entry = await db.journalEntry.findUnique({ where: { id } });
    if (!entry) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json({ ...entry, lines: parseLines(entry.lines) });
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.journalEntry.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    const data: any = {};
    if (body.date !== undefined) data.date = body.date;
    if (body.description !== undefined) data.description = body.description;
    if (body.buildingId !== undefined) data.buildingId = body.buildingId || null;
    if (body.lines !== undefined) {
      const input = parseLines(body.lines);
      if (!input.length) return NextResponse.json({ error: 'القيد يجب أن يحتوي على سطر واحد على الأقل' }, { status: 400 });
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
      if (lines.some(l => !l.accountCode)) return NextResponse.json({ error: 'كل سطر يجب أن يحدد حسابًا موجودًا' }, { status: 400 });
      if (!isBalanced(lines.map(l => ({ accountCode: l.accountCode, debit: l.debit, credit: l.credit })))) {
        return NextResponse.json({ error: 'القيد غير متوازن — مجموع المدين يجب أن يساوي مجموع الدائن' }, { status: 400 });
      }
      data.lines = JSON.stringify(lines);
    }
    // source/sourceId للنظام فقط — لا تُقبل من الطلب
    delete data.source; delete data.sourceId;

    const entry = await db.journalEntry.update({ where: { id }, data });
    await logAudit(user.id, 'update', 'journalEntry', id, { before: old, after: body }, `تعديل قيد: ${body.description || old.description}`);
    return NextResponse.json({ ...entry, lines: parseLines(entry.lines) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'journal')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.journalEntry.findUnique({ where: { id } });
    if (old && old.source && old.source !== 'manual' && old.sourceId) {
      return NextResponse.json({ error: 'قيد تلقائي مرتبط بعملية مالية — احذف أو عدّل العملية الأصلية بدلًا من القيد' }, { status: 400 });
    }
    await db.journalEntry.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'journalEntry', id, old || undefined, `حذف قيد: ${old?.description}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
