import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * الترقيم التسلسلي للمستندات — سندات القبض والصرف والعقود وفواتير الإيجار
 * =============================================================
 * كل تسلسل له عدّاد واحد في جدول DocCounter يتزايد ذريًا (upsert + increment)
 * داخل معاملة الإنشاء نفسها — لا يتكرر رقم أبدًا ولا يمرّ رقم من المستخدم.
 *
 * التسلسلات:
 *   receipt  → سندات القبض  (ق-0001): تحصيل إيجار، إيراد، استلام قرض
 *   payment  → سندات الصرف  (ص-0001): مصروف، صيانة، دفعة مورد، قسط قرض
 *   contract → العقود       (ع-0001)
 *   invoice  → فواتير الإيجار (ف-0001)
 */

export type DocCounterKey = 'receipt' | 'payment' | 'contract' | 'invoice';

export const DOC_PREFIX: Record<DocCounterKey, string> = {
  receipt: 'ق',
  payment: 'ص',
  contract: 'ع',
  invoice: 'ف',
};

// اسم كل تسلسل للعرض في الواجهة والتقارير
export const DOC_LABEL: Record<DocCounterKey, string> = {
  receipt: 'سندات القبض',
  payment: 'سندات الصرف',
  contract: 'العقود',
  invoice: 'فواتير الإيجار',
};

type TxClient = Prisma.TransactionClient;

/**
 * يزيد العدّاد الذريًا ويعيد الرقم التسلسلي الجديد (مثل «ق-0007»).
 * يعمل داخل أي معاملة (tx) أو على العميل المباشر — upsert ذري في Postgres و SQLite.
 */
export async function nextDocNumber(txc: TxClient | PrismaClient, key: DocCounterKey): Promise<string> {
  const counter = await txc.docCounter.upsert({
    where: { key },
    create: { key, current: 1 },
    update: { current: { increment: 1 } },
  });
  return `${DOC_PREFIX[key]}-${String(counter.current).padStart(4, '0')}`;
}

/** هل الدفعة محصّلة (تستحق سند قبض)؟ */
export function isCollectedStatus(status: string | null | undefined): boolean {
  return status === 'paid' || status === 'partial';
}
