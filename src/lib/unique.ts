// =============================================================
// منع تكرار الأسماء — لا يُقبل سجلان بنفس الاسم في نفس الصفحة
// المقارنة معيارية: تتجاهل حالة الأحرف والمسافات الزائدة والتطويل
// والتشكيل وفروق الألف بالهمزة — وتعمل على SQLite (تطوير) و
// Postgres (إنتاج) بلا استعلامات خاصة بمحرك قاعدة البيانات.
// =============================================================

/** توحيد الاسم للمقارنة فقط — لا يُخزَّن في قاعدة البيانات */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')            // المسافات المكررة → مسافة واحدة
    .replace(/ـ/g, '')               // التطويل
    .replace(/[\u064B-\u0652]/g, '') // التشكيل
    .replace(/[أإآٱ]/g, 'ا')         // توحيد الألف بالهمزات
    .toLowerCase();                  // حالة الأحرف للاتيني
}

/**
 * فحص تكرار الاسم بين سجلات موجودة.
 * @param items السجلات الموجودة (id + name)
 * @param name الاسم الجديد المطلوب حفظه
 * @param options.excludeId سجل يُستثنى من المقارنة (التعديل على نفس السجل)
 * @param options.field تسمية الحقل في رسالة الخطأ — مثل «اسم المورد»
 * @returns رسالة خطأ جاهزة للعرض أو null إن كان الاسم فريدًا
 */
export function duplicateNameError(
  items: { id: string; name: string }[],
  name: unknown,
  options?: { excludeId?: string; field?: string },
): string | null {
  const field = options?.field || 'الاسم';
  const key = normalizeName(name);
  if (!key) return null;
  const dup = items.find(it => it.id !== options?.excludeId && normalizeName(it?.name) === key);
  return dup
    ? `«${String(name).trim()}» مسجّل بالفعل — لا يُسمح بتكرار ${field}، اختر اسماً مختلفاً`
    : null;
}

/**
 * فحص تكرار رقم الوحدة داخل نفس العمارة — رقم الوحدة لا يتكرر إلا عبر العمارات المختلفة.
 * @returns رسالة خطأ جاهزة أو null إن كان الرقم فريدًا داخل العمارة
 */
export function duplicateUnitNumberError(
  units: { id: string; number: string }[],
  number: unknown,
  excludeId?: string,
): string | null {
  const key = normalizeName(number);
  if (!key) return null;
  const dup = units.find(u => u.id !== excludeId && normalizeName(u.number) === key);
  return dup
    ? `رقم الوحدة «${String(number).trim()}» موجود بالفعل في نفس العمارة — لا يُسمح بتكرار رقم الوحدة`
    : null;
}
