// =============================================================
// شجرة الحسابات الافتراضية — لإدارة عقارات صغيرة في دولة الكويت
// العملة: دينار كويتي (KWD) — محاسبة القيد المزدوج
// الأكواد: 1 أصول | 2 التزامات | 3 حقوق ملكية | 4 إيرادات | 5 مصروفات
// kind: group (رئيسي/تجميعي لا يُسجل عليه) | post (فرعي يُسجل عليه)
// الترتيب: الآباء قبل الأبناء (import صاعد)
// =============================================================

export interface DefaultAccount {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  kind: 'group' | 'post';
  parentCode?: string;
}

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  // === 1 الأصول ===
  { code: '1', name: 'الأصول', type: 'asset', kind: 'group' },
  { code: '11', name: 'الأصول المتداولة', type: 'asset', kind: 'group', parentCode: '1' },
  { code: '1101', name: 'النقد بالصندوق', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '1102', name: 'النقد بالبنك — الحساب الجاري', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '1103', name: 'النقد بالبنك — الحساب التوفيري', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '1104', name: 'الذمم المدينة — إيجارات مستحقة', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '1105', name: 'شيكات برسم التحصيل', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '1106', name: 'مصروفات مدفوعة مقدماً', type: 'asset', kind: 'post', parentCode: '11' },
  { code: '12', name: 'الأصول الثابتة', type: 'asset', kind: 'group', parentCode: '1' },
  { code: '1201', name: 'أراضٍ', type: 'asset', kind: 'post', parentCode: '12' },
  { code: '1202', name: 'عمارات استثمارية', type: 'asset', kind: 'post', parentCode: '12' },
  { code: '1203', name: 'مجمع الإهلاك — العمارات', type: 'asset', kind: 'post', parentCode: '12' },
  { code: '1204', name: 'سيارات', type: 'asset', kind: 'post', parentCode: '12' },
  { code: '1205', name: 'أثاث ومعدات', type: 'asset', kind: 'post', parentCode: '12' },

  // === 2 الالتزامات ===
  { code: '2', name: 'الالتزامات', type: 'liability', kind: 'group' },
  { code: '21', name: 'التزامات متداولة', type: 'liability', kind: 'group', parentCode: '2' },
  { code: '2101', name: 'الذمم الدائنة — موردين', type: 'liability', kind: 'post', parentCode: '21' },
  { code: '2102', name: 'مصروفات مستحقة', type: 'liability', kind: 'post', parentCode: '21' },
  { code: '2103', name: 'تأمينات المستأجرين (ودائع قابلة للرد)', type: 'liability', kind: 'post', parentCode: '21' },
  { code: '2104', name: 'إيجارات محصلة مقدماً', type: 'liability', kind: 'post', parentCode: '21' },

  // === 3 حقوق الملكية ===
  { code: '3', name: 'حقوق الملكية', type: 'equity', kind: 'group' },
  { code: '3101', name: 'رأس المال', type: 'equity', kind: 'post', parentCode: '3' },
  { code: '3102', name: 'رأس مال إضافي', type: 'equity', kind: 'post', parentCode: '3' },
  { code: '3103', name: 'الأرباح المبقاة', type: 'equity', kind: 'post', parentCode: '3' },
  { code: '3104', name: 'أرباح السنة الحالية', type: 'equity', kind: 'post', parentCode: '3' },
  { code: '3105', name: 'المسحوبات الشخصية', type: 'equity', kind: 'post', parentCode: '3' },

  // === 4 الإيرادات ===
  { code: '4', name: 'الإيرادات', type: 'revenue', kind: 'group' },
  { code: '41', name: 'إيرادات التشغيل', type: 'revenue', kind: 'group', parentCode: '4' },
  { code: '4101', name: 'إيرادات إيجار سكني', type: 'revenue', kind: 'post', parentCode: '41' },
  { code: '4102', name: 'إيرادات إيجار تجاري (محلات ومكاتب)', type: 'revenue', kind: 'post', parentCode: '41' },
  { code: '4103', name: 'إيرادات إيجار مستودعات', type: 'revenue', kind: 'post', parentCode: '41' },
  { code: '4104', name: 'إيرادات خدمات ومرافق (مصاعد، صيانة مشتركة)', type: 'revenue', kind: 'post', parentCode: '41' },
  { code: '42', name: 'إيرادات أخرى', type: 'revenue', kind: 'group', parentCode: '4' },
  { code: '4201', name: 'تعويضات إخلاء وتسويات', type: 'revenue', kind: 'post', parentCode: '42' },
  { code: '4202', name: 'إيرادات متنوعة', type: 'revenue', kind: 'post', parentCode: '42' },

  // === 5 المصروفات ===
  { code: '5', name: 'المصروفات', type: 'expense', kind: 'group' },
  { code: '51', name: 'مصروفات التشغيل العقاري', type: 'expense', kind: 'group', parentCode: '5' },
  { code: '5101', name: 'صيانة وإصلاحات', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '5102', name: 'كهرباء ومياه (مناطق مشتركة)', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '5103', name: 'عقود نظافة', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '5104', name: 'عقود مصاعد وسلامة', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '5105', name: 'تأمين العقارات', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '5106', name: 'أتعاب إدارة الأملاك', type: 'expense', kind: 'post', parentCode: '51' },
  { code: '52', name: 'مصروفات عمومية وإدارية', type: 'expense', kind: 'group', parentCode: '5' },
  { code: '5201', name: 'رواتب وأجور', type: 'expense', kind: 'post', parentCode: '52' },
  { code: '5202', name: 'مصروفات إدارية وقرطاسية', type: 'expense', kind: 'post', parentCode: '52' },
  { code: '5203', name: 'رسوم حكومية وتراخيص', type: 'expense', kind: 'post', parentCode: '52' },
  { code: '5204', name: 'مصروف بنكية', type: 'expense', kind: 'post', parentCode: '52' },
  { code: '5205', name: 'مصروف إهلاك', type: 'expense', kind: 'post', parentCode: '52' },
  { code: '5206', name: 'مصروفات متنوعة', type: 'expense', kind: 'post', parentCode: '52' },
];
