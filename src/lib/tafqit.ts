// =============================================================
// تفقيط المبالغ — تحويل الرقم إلى كلمات عربية
// العملة: دينار كويتي (KWD) — 1000 فلس = 1 دينار (3 خانات عشرية)
// يُستخدم في سندات القبض والصرف المطبوعة
// =============================================================

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function under100(n: number): string {
  if (n <= 0) return '';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${ONES[o]} و${TENS[t]}` : TENS[t];
}

function under1000(n: number): string {
  if (n <= 0) return '';
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${HUNDREDS[h]} و${under100(r)}` : HUNDREDS[h];
}

function thousandsWords(n: number): string {
  if (n === 1) return 'ألف';
  if (n === 2) return 'ألفان';
  if (n >= 3 && n <= 10) return `${under1000(n)} آلاف`;
  return `${under1000(n)} ألفًا`;
}

function millionsWords(n: number): string {
  if (n === 1) return 'مليون';
  if (n === 2) return 'مليونان';
  if (n >= 3 && n <= 10) return `${under1000(n)} ملايين`;
  return `${under1000(n)} مليونًا`;
}

/** تحويل عدد صحيح إلى كلمات عربية (حتى 999,999,999) */
export function integerToArabicWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'صفر';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millionsWords(millions));
  if (thousands) parts.push(thousandsWords(thousands));
  if (rest) parts.push(under1000(rest));
  return parts.join(' و');
}

interface UnitForms {
  single: string; // 1 : دينار واحد
  dual: string;   // 2 : ديناران
  few: string;    // 3-10 : دنانير
  many: string;   // 11-99 : دينارًا
  plain: string;  // مئات/آلاف/صفر : دينار
}

const KWD_FORMS: UnitForms = { single: 'دينار واحد', dual: 'ديناران', few: 'دنانير', many: 'دينارًا', plain: 'دينار' };
const FILS_FORMS: UnitForms = { single: 'فلس واحد', dual: 'فلسان', few: 'فلوس', many: 'فلسًا', plain: 'فلس' };

function amountWithUnit(n: number, u: UnitForms): string {
  if (n <= 0) return '';
  if (n === 1) return u.single;
  if (n === 2) return u.dual;
  const r = n % 100;
  const tail = r >= 3 && r <= 10 ? u.few : r >= 11 && r <= 99 ? u.many : u.plain;
  return `${integerToArabicWords(n)} ${tail}`;
}

/**
 * تفقيط مبلغ بالدينار الكويتي مع الفلسات:
 * 1234.5 → "ألف ومائتان وأربعة وثلاثون دينارًا وخمسمائة فلس فقط لا غير"
 */
export function tafqitKWD(amount: number): string {
  const neg = amount < 0;
  const totalFils = Math.round(Math.abs(amount) * 1000);
  const dinars = Math.floor(totalFils / 1000);
  const fils = totalFils % 1000;
  const parts: string[] = [];
  const dWords = amountWithUnit(dinars, KWD_FORMS);
  if (dWords) parts.push(dWords);
  const fWords = amountWithUnit(fils, FILS_FORMS);
  if (fWords) parts.push(fWords);
  let s = parts.length ? parts.join(' و') + ' فقط لا غير' : 'صفر دينار فقط لا غير';
  if (neg) s = 'سالب ' + s;
  return s;
}
