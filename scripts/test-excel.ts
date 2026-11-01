// اختبار سريع لمنطق مكتبة الإكسل: كتابة ملف → قراءته → تحليل الصفوف
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { ENTITIES, readExcelFile } from '../src/lib/excel';

function fileOf(path: string): File {
  const buf = fs.readFileSync(path);
  return new File([buf], 'test.xlsx');
}

async function main() {
  let failures = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    if (!cond) failures++;
  };

  // 1) إنشاء ملف شبه القالب للعمارات وقراءته
  const bDef = ENTITIES.buildings;
  const aoa = [
    bDef.columns.map(c => c.header),
    bDef.columns.map(c => c.note || ''),
    bDef.columns.map(c => c.example || ''),
    ['B02', 'عمارة حولي', 'شارع التحرير', 'حولي', '4', '8', '180000', 'L-2024-77', 'تجريبي'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa as any[][]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العمارات');
  XLSX.writeFile(wb, '/tmp/test-buildings.xlsx');

  const { rows } = await readExcelFile(fileOf('/tmp/test-buildings.xlsx'), 'buildings');
  check('قراءة الملف: عدد الصفوف = 1 (تم تجاهل صف الإرشاد والمثال)', rows.length === 1, `فعلًا ${rows.length}`);
  const parsedBuilding = bDef.parseRow(rows[0], bDef.columns, { buildings: [], units: [], tenants: [], contracts: [] }, new Set());
  check('تحليل عمارة سليم', parsedBuilding.ok && parsedBuilding.data?.name === 'عمارة حولي' && parsedBuilding.data?.floors === 4, JSON.stringify(parsedBuilding.data || parsedBuilding.error));

  // 2) وحدة مرتبطة بعمارة + أرقام عربية + حالة عربية
  const uDef = ENTITIES.units;
  const unitRow = { 'العمارة': 'عمارة حولي', 'رقم الوحدة': '١٠٢', 'الطابق': '٢', 'المساحة م2': '١٢٠٫٥', 'النوع': 'شقة', 'الحالة': 'مؤجرة', 'الإيجار الشهري': '350,5' };
  const ctx = { buildings: [{ id: 'b1', code: 'B02', name: 'عمارة حولي' }], units: [], tenants: [], contracts: [] } as any;
  const pUnit = uDef.parseRow(unitRow as any, uDef.columns, ctx, new Set());
  check('تحليل وحدة: أرقام عربية + مرجع عمارة بالاسم', pUnit.ok && pUnit.data?.buildingId === 'b1' && pUnit.data?.rentAmount === 350.5 && pUnit.data?.status === 'rented' && pUnit.data?.floor === 2, JSON.stringify(pUnit.data || pUnit.error));

  // 3) عقد بمستأجر موجود
  const cDef = ENTITIES.contracts;
  const contractRow = { 'العمارة': 'B02', 'رقم الوحدة': '102', 'المستأجر': 'أحمد محمد', 'تاريخ البداية': '01/02/2025', 'تاريخ النهاية': '31/01/2026', 'الإيجار': '400', 'مبلغ التأمين': '200', 'يوم الدفع (1-31)': '5', 'الحالة': 'نشط' };
  const ctx2 = { buildings: [{ id: 'b1', code: 'B02', name: 'عمارة حولي' }], units: [{ id: 'u1', buildingId: 'b1', number: '102' }], tenants: [{ id: 't1', name: 'أحمد محمد' }], contracts: [] } as any;
  const pContract = cDef.parseRow(contractRow as any, cDef.columns, ctx2, new Set());
  check('تحليل عقد: تاريخ مصري DD/MM/YYYY + مراجع', pContract.ok && pContract.data?.startDate === '2025-02-01' && pContract.data?.endDate === '2026-01-31' && pContract.data?.unitId === 'u1', JSON.stringify(pContract.data || pContract.error));

  // 4) دفعة بمرجع عقد (مستأجر + وحدة) وطريقة دفع عربية
  const payDef = ENTITIES.payments;
  const payRow = { 'المستأجر': 'أحمد محمد', 'رقم الوحدة': '102', 'المبلغ': '٤٠٠', 'تاريخ الاستحقاق': '2025-03-05', 'تاريخ الدفع': '2025-03-03', 'عن شهر': '2025-03', 'الحالة': 'مدفوع', 'طريقة الدفع': 'تحويل بنكي' };
  const ctx3 = { buildings: [], units: [], tenants: [{ id: 't1', name: 'أحمد محمد' }], contracts: [{ id: 'c1', tenantId: 't1', unitId: 'u1', status: 'active', createdAt: '2025-01-01' }] } as any;
  const pPay = payDef.parseRow(payRow as any, payDef.columns, ctx3, new Set());
  check('تحليل دفعة: حل العقد + مبلغ عربي + طريقة عربية', pPay.ok && pPay.data?.contractId === 'c1' && pPay.data?.amount === 400 && pPay.data?.method === 'transfer', JSON.stringify(pPay.data || pPay.error));

  // 5) دفعة بدون مراجع → خطأ واضح
  const pPay2 = payDef.parseRow({ 'المبلغ': '100', 'تاريخ الاستحقاق': '2025-03-05' } as any, payDef.columns, ctx3, new Set());
  check('دفعة بلا مرجع عقد → خطأ مفهوم', !pPay2.ok && (pPay2.error || '').includes('العقد'), pPay2.error);

  // 6) صف الإرشاد لا يُقرأ كبيانات
  const { rows: rows2 } = await readExcelFile(fileOf('/tmp/test-buildings.xlsx'), 'buildings');
  const hasGuide = rows2.some(r => String(r['الكود'] || '').includes('إجباري'));
  check('صف الإرشاد مُتجاهل', !hasGuide);

  console.log(failures === 0 ? '\n🎉 كل الاختبارات نجحت' : `\n⚠️ ${failures} اختبار فشل`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error('💥', e); process.exit(1); });
