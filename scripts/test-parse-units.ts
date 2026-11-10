import * as XLSX from 'xlsx';
const DICT: Record<string, string> = { 'متاحة': 'available', 'متاح': 'available', 'شاغرة': 'available', 'مؤجرة': 'rented', 'مؤجر': 'rented', 'مؤجّرة': 'rented', 'مشغولة': 'rented', 'صيانة': 'maintenance', 'تحت الصيانة': 'maintenance', 'محجوزة': 'reserved', 'محجوز': 'reserved' };
const wb = XLSX.readFile('upload/قالب-الوحدات (1).xlsx', { type: 'file', cellDates: true });
const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['الوحدات'], { defval: '' });
const dataRows = rows.filter(r => String(r['رقم الوحدة'] ?? '').trim() !== 'إجباري');
const counts: Record<string, number> = {};
dataRows.forEach(r => {
  const v = String(r['الحالة'] ?? '').trim();
  const mapped = DICT[v] || 'available';
  counts[mapped] = (counts[mapped] || 0) + 1;
});
console.log('صفوف البيانات:', dataRows.length, '→ لو ااستورد الملف الحالي زي ما هو:', JSON.stringify(counts));
