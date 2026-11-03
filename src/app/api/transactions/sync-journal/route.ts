import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncTransactionEntry } from '@/lib/accounting';

/**
 * مزامنة قيود الحركات المالية القديمة (قبل ربط الحركات بالمحاسبة):
 * يمر على كل الحركات ويولّد القيد المزدوج لمن لا قيد له (upsert — لن يكرر أي قيد قائم)
 * للمدير/المدير الفرعي فقط — تشغيل واحد يكفي بعد التحديث
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user.role !== 'admin' && user.role !== 'manager')
      return NextResponse.json({ error: 'ليست لديك صلاحية — للمدير فقط' }, { status: 403 });

    const transactions = await db.transaction.findMany();
    let synced = 0;
    const failed: { id: string; category: string; error: string }[] = [];

    for (const tx of transactions) {
      try {
        const before = await db.journalEntry.findUnique({
          where: { source_sourceId: { source: 'transaction', sourceId: tx.id } },
          select: { id: true },
        });
        await syncTransactionEntry(db, tx);
        if (!before) synced++; // قيد جديد فعلاً (وليس تحديث قيد قائم)
      } catch (e: any) {
        failed.push({ id: tx.id, category: tx.category || '-', error: e?.message || 'خطأ' });
      }
    }

    await logAudit(user.id, 'update', 'transaction', '-', { synced }, `مزامنة قيود الحركات المالية: ${synced} قيد جديد`);
    return NextResponse.json({ total: transactions.length, synced, failedCount: failed.length, failed: failed.slice(0, 10) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
