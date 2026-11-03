// إعادة بناء بيانات الاختبار الأساسية عبر API التطبيق نفسه (كعميل)
const BASE = 'http://localhost:3000';
let TOKEN = process.argv[2];

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

(async () => {
  // عمارتان
  const b1 = await api('/api/buildings', 'POST', { name: 'المهبولة 2', code: 'B-001', address: 'المهبولة - قطعة 12', city: 'الأحمدي', floors: 12, value: 250000, license: 'LIC-2024-001', notes: 'عمارة سكنية' });
  const b2 = await api('/api/buildings', 'POST', { name: 'برج الفروانية', code: 'F-002', address: 'الفروانية - جادة 45', city: 'الفروانية', floors: 5, value: 400000, license: 'LIC-2024-002', notes: 'برج مختلط (سكني وتجاري)' });
  console.log('buildings OK:', b1.id, b2.id);

  // وحدات المهبولة 2
  const u = {};
  for (const x of [
    { buildingId: b1.id, number: 'A1', floor: 1, area: 120, type: 'apartment', rentAmount: 300 },
    { buildingId: b1.id, number: 'A2', floor: 2, area: 140, type: 'apartment', rentAmount: 350 },
    { buildingId: b1.id, number: 'A3', floor: 3, area: 150, type: 'apartment', rentAmount: 400 },
    { buildingId: b2.id, number: 'B1', floor: 2, area: 130, type: 'apartment', rentAmount: 400 },
    { buildingId: b2.id, number: 'B2', floor: 3, area: 160, type: 'apartment', rentAmount: 450 },
    { buildingId: b2.id, number: 'O1', floor: 1, area: 200, type: 'office', rentAmount: 600 },
  ]) u[x.number] = await api('/api/units', 'POST', x);
  console.log('units OK:', Object.keys(u).join(','));

  // مستأجرون
  const t = {};
  t.nour = await api('/api/tenants', 'POST', { name: 'شركة النور للتجارة', tenantType: 'company', commercialReg: 'CR-123456', phone: '99887766', email: 'nour@test.kw', address: 'حولي' });
  t.ahmad = await api('/api/tenants', 'POST', { name: 'أحمد خالد العازمي', tenantType: 'individual', idNumber: '289011203456', idType: 'national', phone: '55443322', guarantor: 'خالد العازمي', guarantorPhone: '55440099' });
  t.gulf = await api('/api/tenants', 'POST', { name: 'مؤسسة الخليج للمقاولات', tenantType: 'company', commercialReg: 'CR-998877', phone: '99554433', email: 'gulf@test.kw', address: 'الفروانية' });
  t.fahad = await api('/api/tenants', 'POST', { name: 'فهد سعيد المطيري', tenantType: 'individual', idNumber: '298503401234', idType: 'national', phone: '99001122', guarantor: 'سالم ناصر الصباح', guarantorPhone: '99881234' });
  t.yousef = await api('/api/tenants', 'POST', { name: 'يوسف إبراهيم الشمري', tenantType: 'individual', idNumber: '301122304567', idType: 'national', phone: '99665544' });
  console.log('tenants OK');

  // عقود (نفس سيناريو الاختبار السابق)
  const c = {};
  c.nourA1 = await api('/api/contracts', 'POST', { unitId: u.A1.id, tenantId: t.nour.id, rentAmount: 300, startDate: '2026-01-01', endDate: '2026-12-31', deposit: 300, status: 'active' });
  c.ahmadA2 = await api('/api/contracts', 'POST', { unitId: u.A2.id, tenantId: t.ahmad.id, rentAmount: 350, startDate: '2026-01-01', endDate: '2026-12-31', deposit: 350, status: 'active' });
  c.gulfB2 = await api('/api/contracts', 'POST', { unitId: u.B2.id, tenantId: t.gulf.id, rentAmount: 450, startDate: '2025-09-01', endDate: '2026-08-31', deposit: 450, status: 'active' });
  c.gulfO1 = await api('/api/contracts', 'POST', { unitId: u.O1.id, tenantId: t.gulf.id, rentAmount: 600, startDate: '2026-01-15', endDate: '2026-12-31', deposit: 600, status: 'active' });
  c.fahadB1 = await api('/api/contracts', 'POST', { unitId: u.B1.id, tenantId: t.fahad.id, rentAmount: 400, startDate: '2026-08-01', endDate: '2027-07-31', deposit: 400, status: 'active' });
  c.yousefA3 = await api('/api/contracts', 'POST', { unitId: u.A3.id, tenantId: t.yousef.id, rentAmount: 400, startDate: '2026-10-01', endDate: '2027-09-30', deposit: 400, status: 'active' });
  console.log('contracts OK');

  // الوحدات المؤجرة (status=rented)
  for (const k of ['A1', 'A2', 'A3', 'B1', 'B2', 'O1']) await api(`/api/units/${u[k].id}`, 'PUT', { ...u[k], status: 'rented' });
  console.log('units rented OK');
  console.log('SEED DONE');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
