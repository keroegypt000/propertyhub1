// =============================================================
// حسابات مالية مشتركة — مصدر واحد للحقائق لكل الواجهة والـ API
// القواعد:
// - الدخل المتوقع الشهري = مجموع الإيجار الافتراضي للوحدات القابلة للتأجير (المتاحة + المؤجرة)
// - الدخل التعاقدي الشهري = مجموع إيجار العقود النشطة فقط
// - إمكانات الشواغر = الإيجار الافتراضي للوحدات المتاحة القابلة للتأجير
// - الدخل السنوي = الشهري × 12
// - لا عد مزدوج: الوحدة غير القابلة للتأجير (maintenance) تُستثنى من المتوقع
// - العملة الافتراضية: دينار كويتي (KWD) بثلاث خانات عشرية
// =============================================================

export interface CalcUnit {
  id: string;
  buildingId: string;
  status: string;         // available, rented, maintenance, reserved
  rentAmount?: number | null; // الإيجار الافتراضي للوحدة
}

export interface CalcContract {
  id: string;
  unitId: string;
  status: string;         // active, expired, terminated, renewed, vacated
  rentAmount: number;     // الإيجار الشهري قبل الخصم
  discount?: number | null; // الخصم الشهري — الإيجار الفعلي = rentAmount - discount
  startDate: string | Date;
  endDate: string | Date;
}

/** الإيجار الشهري الفعلي بعد الخصم (لا ينزل عن صفر) */
export function effectiveRent(c: Pick<CalcContract, 'rentAmount' | 'discount'>): number {
  return Math.max(0, (c.rentAmount || 0) - (c.discount || 0));
}

export interface BuildingIncomeStats {
  rentableUnits: number;
  vacantUnits: number;
  occupiedUnits: number;
  nonRentableUnits: number;
  expectedMonthly: number;      // متوقع شهرياً (افتراضي للوحدات القابلة للتأجير)
  expectedAnnual: number;
  contractedMonthly: number;    // تعاقدي شهري (عقود نشطة)
  contractedAnnual: number;
  vacantPotentialMonthly: number; // إمكانات الشواغر شهرياً
  occupiedContractedMonthly: number; // تعاقدي من الوحدات المؤجرة
  difference: number;           // التعاقدي - المتوقع
  differencePct: number;        // النسبة المئوية
}

const RENTABLE_STATUSES = ['available', 'rented'];
const ACTIVE_CONTRACT_STATUSES = ['active', 'renewed'];

/** وحدات مبنى معين */
export function unitsOfBuilding(units: CalcUnit[], buildingId: string): CalcUnit[] {
  return units.filter(u => u.buildingId === buildingId);
}

/** العقود النشطة الفعلية (بدون تداخل ولا عد مزدوج للوحدة) */
export function activeContractsOfUnit(contracts: CalcContract[], unitId: string): CalcContract[] {
  return contracts.filter(c => c.unitId === unitId && ACTIVE_CONTRACT_STATUSES.includes(c.status));
}

/** إحصائيات دخل مبنى واحد */
export function buildingIncomeStats(units: CalcUnit[], contracts: CalcContract[], buildingId: string): BuildingIncomeStats {
  const bUnits = unitsOfBuilding(units, buildingId);
  const rentable = bUnits.filter(u => RENTABLE_STATUSES.includes(u.status));
  const vacant = rentable.filter(u => u.status === 'available');
  const occupied = rentable.filter(u => u.status === 'rented');
  const nonRentable = bUnits.filter(u => !RENTABLE_STATUSES.includes(u.status));

  const expectedMonthly = rentable.reduce((s, u) => s + (u.rentAmount || 0), 0);
  const vacantPotentialMonthly = vacant.reduce((s, u) => s + (u.rentAmount || 0), 0);

  // التعاقدي: عقد نشط واحد كحد أقصى لكل وحدة (نأخذ الأحدث إذا تعددت) — بالإيجار الفعلي بعد الخصم
  let contractedMonthly = 0;
  for (const u of bUnits) {
    const actives = activeContractsOfUnit(contracts, u.id)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    if (actives.length > 0) contractedMonthly += effectiveRent(actives[0]);
  }

  const expectedAnnual = expectedMonthly * 12;
  const contractedAnnual = contractedMonthly * 12;
  const difference = contractedMonthly - expectedMonthly;

  return {
    rentableUnits: rentable.length,
    vacantUnits: vacant.length,
    occupiedUnits: occupied.length,
    nonRentableUnits: nonRentable.length,
    expectedMonthly,
    expectedAnnual,
    contractedMonthly,
    contractedAnnual,
    vacantPotentialMonthly,
    occupiedContractedMonthly: contractedMonthly - vacantPotentialMonthly,
    difference,
    differencePct: expectedMonthly > 0 ? (difference / expectedMonthly) * 100 : 0,
  };
}

/** إجمالي عام لكل المباني */
export function totalIncomeStats(units: CalcUnit[], contracts: CalcContract[], buildingIds: string[]): BuildingIncomeStats {
  const empty: BuildingIncomeStats = {
    rentableUnits: 0, vacantUnits: 0, occupiedUnits: 0, nonRentableUnits: 0,
    expectedMonthly: 0, expectedAnnual: 0, contractedMonthly: 0, contractedAnnual: 0,
    vacantPotentialMonthly: 0, occupiedContractedMonthly: 0, difference: 0, differencePct: 0,
  };
  return buildingIds.reduce((acc, id) => {
    const s = buildingIncomeStats(units, contracts, id);
    return {
      rentableUnits: acc.rentableUnits + s.rentableUnits,
      vacantUnits: acc.vacantUnits + s.vacantUnits,
      occupiedUnits: acc.occupiedUnits + s.occupiedUnits,
      nonRentableUnits: acc.nonRentableUnits + s.nonRentableUnits,
      expectedMonthly: acc.expectedMonthly + s.expectedMonthly,
      expectedAnnual: acc.expectedAnnual + s.expectedAnnual,
      contractedMonthly: acc.contractedMonthly + s.contractedMonthly,
      contractedAnnual: acc.contractedAnnual + s.contractedAnnual,
      vacantPotentialMonthly: acc.vacantPotentialMonthly + s.vacantPotentialMonthly,
      occupiedContractedMonthly: acc.occupiedContractedMonthly + s.occupiedContractedMonthly,
      difference: acc.difference + s.difference,
      differencePct: 0,
    };
  }, { ...empty });
}

/** المحصل الفعلي (الإيرادات الحقيقية) من الدفعات المسجلة خلال الفترة */
export interface CollectedStats {
  monthly: number;  // المحصل في الشهر الحالي (حسب تاريخ الدفع)
  annual: number;   // المحصل في السنة الحالية (حسب تاريخ الدفع)
  total: number;    // المحصل الكلي (كل الفترات — غير الملغاة المسددة)
}

/**
 * المحصل الفعلي = مجموع مبالغ الدفعات المسجلة (المسددة فعلاً) خلال الفترة.
 * - يُستثنى: cancelled (ملغاة) و pending/overdue (لم تُسدد بعد).
 * - partial تُعد محصلة بمبلغها المسجل (المدفوع فعلاً).
 * - المرجع الزمني: paidDate، وإن غابت يُستخدم dueDate.
 */
export function collectedStats(
  payments: { amount: number; status: string; paidDate?: string | Date | null; dueDate?: string | Date | null }[],
  asOf: Date = new Date(),
): CollectedStats {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const COLLECTED_STATUSES = ['paid', 'partial'];
  let monthly = 0, annual = 0, total = 0;
  for (const p of payments) {
    if (!COLLECTED_STATUSES.includes(p.status)) continue;
    total += p.amount || 0;
    const d = p.paidDate ? new Date(p.paidDate) : (p.dueDate ? new Date(p.dueDate) : null);
    if (!d || isNaN(d.getTime())) continue;
    if (d.getFullYear() !== y) continue;
    annual += p.amount || 0;
    if (d.getMonth() === m) monthly += p.amount || 0;
  }
  return { monthly, annual, total };
}

/** المتأخرات = مجموع المتبقي المستحق غير المحصل على العقود النشطة فقط (نفس منطق contractBalance في لوحة التحكم) */
export function arrearsOfContracts(
  contracts: (CalcContract & { payments?: { amount: number; status: string }[] })[],
  asOf: Date = new Date(),
): number {
  return contracts
    .filter(c => ACTIVE_CONTRACT_STATUSES.includes(c.status))
    .reduce((s, c) => s + contractBalance(c, (c.payments || []) as any, asOf).outstanding, 0);
}

/** المديونية لكل عقد: المستحق حتى الآن مقابل المدفوع فعلياً */
export interface ContractBalance {
  monthsElapsed: number;   // عدد الأشهر المستحقة حتى الآن (بحدود مدة العقد)
  totalDue: number;        // المستحق = أشهر مستحقة × الإيجار التعاقدي
  totalPaid: number;       // المجموع المدفوع فعلياً (دفعات مسجلة غير ملغاة)
  outstanding: number;     // المتبقي
}

export function contractBalance(
  contract: CalcContract,
  payments: { amount: number; status: string; dueDate?: string | Date; paidDate?: string | Date | null }[],
  asOf: Date = new Date(),
): ContractBalance {
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  const ref = asOf < end ? asOf : end;
  // الأشهر المستحقة: من تاريخ البداية حتى اليوم (أو النهاية) — أقل حد 0
  let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
  // إذا تجاوزنا يوم الدفع في الشهر الحالي يُحسب الشهر مستحقاً
  if (ref.getDate() >= start.getDate() || months === 0) months += 1;
  months = Math.max(0, Math.min(months, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1));

  const totalDue = months * effectiveRent(contract);
  const totalPaid = payments
    .filter(p => p.status !== 'cancelled')
    .reduce((s, p) => s + (p.amount || 0), 0);

  return {
    monthsElapsed: months,
    totalDue,
    totalPaid,
    outstanding: Math.max(0, totalDue - totalPaid),
  };
}

/** تنسيق العملة الكويتية بثلاث خانات عشرية */
export function fmtKWD(amount: number | null | undefined): string {
  return (amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
