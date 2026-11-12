// يولّد قالب الوحدات بنفس بنية downloadTemplate في src/lib/excel.ts — لاختبار رفع القالب نفسه
const XLSX = require('/home/z/my-project/node_modules/xlsx');

const headers = ['العمارة', 'رقم الوحدة', 'الطابق', 'المساحة م2', 'النوع', 'الحالة', 'الإيجار الشهري', 'ملاحظات'];
const notes = ['اسم أو كود عمارة موجودة (استورد العمارات أولاً)', 'إجباري', '', '', 'شقة / استوديو / مكتب / محل / مخزن', 'متاحة / مؤجرة / صيانة / محجوزة', '', ''];
const example = ['B01', '101', '1', '120', 'شقة', 'متاحة', '350', ''];

const mode = process.argv[2] || 'empty';
let aoa = [headers, notes, example];
if (mode === 'filled') {
  aoa = [...aoa, ['عمارة الاختبار', '201', '2', '90', 'شقة', 'متاحة', '450', '']];
}
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = headers.map(() => ({ wch: 16 }));
ws['!views'] = [{ RTL: true }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'الوحدات');
// ورقة اقرأني مثل القالب الحقيقي
const info = [
  ['قالب الوحدات — اقرأني'], [''],
  ['ما هذا الملف؟', 'قالب فارغ لتعبئة بيانات بنفسك'],
];
const wsInfo = XLSX.utils.aoa_to_sheet(info);
XLSX.utils.book_append_sheet(wb, wsInfo, 'اقرأني');
const out = mode === 'filled' ? '/tmp/template-units-filled.xlsx' : '/tmp/template-units-empty.xlsx';
XLSX.writeFile(wb, out);
console.log('written:', out);
