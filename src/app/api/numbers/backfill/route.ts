import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';
import { nextDocNumber, isCollectedStatus } from '@/lib/numbering';

/**
 * ترقيم السجلات القديمة التي أُنشئت قبل نظام الترقيم التسلسلي — عملية واحدة آمنة وقابلة للتكرار:
 * - يجلب كل سجل بلا رقم بترتيب الإنشاء (الأقدم أولًا) ويسنده من العدّاد المركزي داخل معاملة واحدة
 * - لا يمس أي سجل له رقم بالفعل — التشغيل المتكرر لا يغيّر شيئًا (idempotent)
 * - الأرقام تُسند بالترتيب الزمني فتطابق تواريخ المستندات قدر الإمكان
 */
export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);

    const result = await db.$transaction(async (tx) => {
      const stats: Record<string, number> = {};

      // العقود — ع-0001
      const contracts = await tx.contract.findMany({ where: { number: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const c of contracts) {
        await tx.contract.update({ where: { id: c.id }, data: { number: await nextDocNumber(tx, 'contract') } });
      }
      stats.contracts = contracts.length;

      // الدفعات — فاتورة إيجار (ف) لكل دفعة + سند قبض (ق) للمحصّلة منها
      const payments = await tx.payment.findMany({ where: { invoiceNo: null }, orderBy: { createdAt: 'asc' }, select: { id: true, status: true } });
      let receipts = 0;
      for (const p of payments) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            invoiceNo: await nextDocNumber(tx, 'invoice'),
            ...(isCollectedStatus(p.status) ? { receiptNo: await nextDocNumber(tx, 'receipt') } : {}),
          },
        });
        if (isCollectedStatus(p.status)) receipts++;
      }
      // دفعات لها فاتورة لكنها محصّلة بلا سند قبض (حالات نادرة قبل الترقيم)
      const orphanCollected = await tx.payment.findMany({ where: { receiptNo: null, status: { in: ['paid', 'partial'] } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const p of orphanCollected) {
        await tx.payment.update({ where: { id: p.id }, data: { receiptNo: await nextDocNumber(tx, 'receipt') } });
        receipts++;
      }
      stats.payments = payments.length;
      stats.receiptVouchers = receipts;

      // الحركات المالية — إيراد → ق / مصروف → ص
      const transactions = await tx.transaction.findMany({ where: { voucherNo: null }, orderBy: { createdAt: 'asc' }, select: { id: true, type: true } });
      for (const t of transactions) {
        await tx.transaction.update({ where: { id: t.id }, data: { voucherNo: await nextDocNumber(tx, t.type === 'income' ? 'receipt' : 'payment') } });
      }
      stats.transactions = transactions.length;

      // القروض — سند استلام (ق)
      const loans = await tx.loan.findMany({ where: { receiptNo: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const l of loans) {
        await tx.loan.update({ where: { id: l.id }, data: { receiptNo: await nextDocNumber(tx, 'receipt') } });
      }
      stats.loans = loans.length;

      // أقساط القروض — سند صرف (ص)
      const loanPayments = await tx.loanPayment.findMany({ where: { paymentNo: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const lp of loanPayments) {
        await tx.loanPayment.update({ where: { id: lp.id }, data: { paymentNo: await nextDocNumber(tx, 'payment') } });
      }
      stats.loanPayments = loanPayments.length;

      // الصيانة المكتملة بتكلفة — سند صرف (ص)
      const maintenance = await tx.maintenanceRequest.findMany({ where: { paymentNo: null, status: 'completed', cost: { gt: 0 } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const m of maintenance) {
        await tx.maintenanceRequest.update({ where: { id: m.id }, data: { paymentNo: await nextDocNumber(tx, 'payment') } });
      }
      stats.maintenance = maintenance.length;

      // دفعات الموردين — سند صرف (ص)
      const supplierPayments = await tx.supplierPayment.findMany({ where: { paymentNo: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const sp of supplierPayments) {
        await tx.supplierPayment.update({ where: { id: sp.id }, data: { paymentNo: await nextDocNumber(tx, 'payment') } });
      }
      stats.supplierPayments = supplierPayments.length;

      return stats;
    });

    const total = Object.values(result).reduce((s, n) => s + n, 0);
    return NextResponse.json({ ok: true, total, details: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
