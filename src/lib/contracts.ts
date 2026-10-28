import { db } from '@/lib/db';

// =============================================================
// منطق العقود المشترك — التحقق ومزامنة الإشغال (يُستخدم من مسارات POST و PUT و DELETE)
// =============================================================

/** التحقق من سلامة بيانات العقد — يُرجع رسالة خطأ بالعربية أو null إذا سليم */
export async function validateContract(body: any, excludeContractId?: string): Promise<string | null> {
  const { unitId, tenantId, startDate, endDate, rentAmount } = body;
  if (!unitId || !tenantId) return 'الوحدة والمستأجر مطلوبان';
  if (!startDate || !endDate) return 'تاريخا البداية والنهاية مطلوبان';
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'تواريخ غير صالحة';
  if (end <= start) return 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
  if (rentAmount === undefined || rentAmount === null || Number(rentAmount) <= 0) return 'قيمة الإيجار يجب أن تكون أكبر من صفر';

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) return 'الوحدة غير موجودة';
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return 'المستأجر غير موجود';

  // منع تداخل العقود النشطة على نفس الوحدة (مع استثناء العقد الجاري تعديله)
  const overlapping = await db.contract.findFirst({
    where: {
      unitId,
      status: { in: ['active', 'renewed'] },
      ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlapping) {
    return `يوجد عقد نشط آخر على هذه الوحدة من ${new Date(overlapping.startDate).toLocaleDateString('ar')} إلى ${new Date(overlapping.endDate).toLocaleDateString('ar')} — أنهِ العقد السابق أو عدّل تواريخه أولاً`;
  }
  return null; // سليم
}

/** مزامنة حالة إشغال الوحدة مع حالة العقد */
export async function syncUnitOccupancy(unitId: string, contractStatus: string): Promise<void> {
  if (['active', 'renewed'].includes(contractStatus)) {
    await db.unit.updateMany({ where: { id: unitId, status: { not: 'maintenance' } }, data: { status: 'rented' } });
  } else if (['terminated', 'vacated', 'expired'].includes(contractStatus)) {
    await db.unit.updateMany({ where: { id: unitId, status: 'rented' }, data: { status: 'available' } });
  }
}
