// ============================================================
// زرع بيانات اختبار غنية عبر API التطبيق (كعميل مصادق)
// يغطي: عمارات، وحدات بكل الحالات، مستأجرين، عقود (نشط/منتهي/مجدد)،
// دفعات على مدار شهور بمواعيد مختلفة (التزام/تأخير/جزئي/مقدمة)،
// صيانة، قضايا ومخالفات، حركات مالية وتوزيع إداري، قروض وأقساط.
// محمي من التكرار: لو لقى عمارة كودها S-003 يطبع ALREADY SEEDED ويقف.
// ============================================================
const BASE = 'http://localhost:3000';
let TOKEN = process.argv[2];
if (!TOKEN) { console.error('usage: node scripts/seed-big-data.js <TOKEN>'); process.exit(1); }

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const pad = (n) => String(n).padStart(2, '0');
const md = (m, d) => `${m}-${pad(d)}`; // '2026-09' , 5 → '2026-09-05'

(async () => {
  // ---------- 0) منع التكرار — الحاجز على آخر عنصر (القرض الرئيسي) ----------
  const loans0 = await api('/api/loans');
  if (loans0.some((l) => String(l.name).includes('قرض بنك الكويت الوطني'))) { console.log('ALREADY SEEDED'); return; }

  // ---------- 1) العمارات: تأكيد الأساس + الجديد ----------
  const buildings0 = await api('/api/buildings');
  const bmap = {};
  for (const b of buildings0) bmap[b.code] = b;
  const baseBuildings = [
    { name: 'المهبولة 2', code: 'B-001', address: 'المهبولة - قطعة 12', city: 'الأحمدي', floors: 12, value: 250000, license: 'LIC-2024-001', notes: 'عمارة سكنية' },
    { name: 'برج الفروانية', code: 'F-002', address: 'الفروانية - جادة 45', city: 'الفروانية', floors: 5, value: 400000, license: 'LIC-2024-002', notes: 'برج مختلط (سكني وتجاري)' },
  ];
  for (const x of baseBuildings) if (!bmap[x.code]) bmap[x.code] = await api('/api/buildings', 'POST', x);
  const newBuildings = [
    { name: 'برج السالمية', code: 'S-003', address: 'السالمية - بلوك 3 شارع السعودية', city: 'حولي', floors: 8, value: 320000, license: 'LIC-2024-003', notes: 'عمارة سكنية مع مصعد' },
    { name: 'عمارة الجهراء', code: 'J-004', address: 'الجهراء - قطعة 8 شارع 20', city: 'الجهراء', floors: 4, value: 150000, license: 'LIC-2024-004', notes: 'سكني اقتصادي' },
    { name: 'مجمع حولي التجاري', code: 'H-005', address: 'حولي - شارع تونس', city: 'حولي', floors: 6, value: 600000, license: 'LIC-2024-005', notes: 'تجاري: محلات ومكاتب' },
    { name: 'عمارة الشعب السكنية', code: 'M-006', address: 'الشعب - بلوك 2', city: 'مدينة الكويت', floors: 7, value: 280000, license: 'LIC-2024-006', notes: 'سكني-تجاري' },
  ];
  for (const x of newBuildings) if (!bmap[x.code]) bmap[x.code] = await api('/api/buildings', 'POST', x);
  console.log('buildings:', Object.keys(bmap).length);

  // ---------- 2) الوحدات: الأساس + الجديد ----------
  const baseUnits = [
    ['B-001', 'A1', 1, 120, 'apartment', 300], ['B-001', 'A2', 2, 140, 'apartment', 350],
    ['B-001', 'A3', 3, 150, 'apartment', 400], ['F-002', 'B1', 2, 130, 'apartment', 400],
    ['F-002', 'B2', 3, 160, 'apartment', 450], ['F-002', 'O1', 1, 200, 'office', 600],
  ];
  const unitDefs = [
    ['S-003', 'S1', 1, 110, 'apartment', 350], ['S-003', 'S2', 2, 100, 'studio', 280],
    ['S-003', 'S3', 3, 120, 'apartment', 320], ['S-003', 'S4', 4, 110, 'apartment', 300],
    ['S-003', 'S5', 5, 95, 'studio', 260], ['S-003', 'S6', 3, 100, 'studio', 240],
    ['S-003', 'S7', 6, 140, 'apartment', 380], ['S-003', 'S8', 7, 105, 'studio', 290],
    ['J-004', 'J1', 1, 90, 'apartment', 200], ['J-004', 'J2', 2, 95, 'apartment', 220],
    ['J-004', 'J3', 3, 85, 'studio', 180], ['J-004', 'J4', 4, 100, 'apartment', 210],
    ['J-004', 'J5', 1, 90, 'apartment', 190], ['J-004', 'J6', 2, 110, 'apartment', 230],
    ['H-005', 'H1', 1, 180, 'shop', 850], ['H-005', 'H2', 2, 150, 'shop', 700],
    ['H-005', 'H3', 3, 120, 'office', 600], ['H-005', 'H4', 4, 110, 'office', 550],
    ['H-005', 'H5', 5, 130, 'office', 650], ['H-005', 'H6', 1, 160, 'shop', 750],
    ['M-006', 'M1', 1, 140, 'apartment', 500], ['M-006', 'M2', 2, 130, 'apartment', 450],
    ['M-006', 'M3', 3, 135, 'apartment', 480], ['M-006', 'M4', 4, 145, 'apartment', 520],
    ['M-006', 'M5', 5, 125, 'apartment', 460], ['M-006', 'M6', 6, 150, 'apartment', 540],
  ];
  let umap = {}; // by unit number
  for (const u of await api('/api/units')) umap[u.number] = u;
  for (const [bc, number, floor, area, type, rentAmount] of [...baseUnits, ...unitDefs]) {
    if (umap[number]) continue;
    umap[number] = await api('/api/units', 'POST', { buildingId: bmap[bc].id, number, floor, area, type, rentAmount });
  }
  console.log('units total:', Object.keys(umap).length);

  // ---------- 3) المستأجرون: الأساس + الجديد ----------
  const baseTenants = [
    { name: 'شركة النور للتجارة', tenantType: 'company', commercialReg: 'CR-123456', phone: '99887766', email: 'nour@test.kw', address: 'حولي' },
    { name: 'أحمد خالد العازمي', tenantType: 'individual', idNumber: '289011203456', idType: 'national', phone: '55443322', guarantor: 'خالد العازمي', guarantorPhone: '55440099' },
    { name: 'مؤسسة الخليج للمقاولات', tenantType: 'company', commercialReg: 'CR-998877', phone: '99554433', email: 'gulf@test.kw', address: 'الفروانية' },
    { name: 'فهد سعيد المطيري', tenantType: 'individual', idNumber: '298503401234', idType: 'national', phone: '99001122', guarantor: 'سالم ناصر الصباح', guarantorPhone: '99881234' },
    { name: 'يوسف إبراهيم الشمري', tenantType: 'individual', idNumber: '301122304567', idType: 'national', phone: '99665544' },
  ];
  const tenantDefs = [
    { name: 'عبدالله ناصر الحربي', tenantType: 'individual', idNumber: '289112304455', idType: 'national', phone: '55112233', guarantor: 'ناصر الحربي', guarantorPhone: '55119988' },
    { name: 'سارة محمد الرشيد', tenantType: 'individual', idNumber: '300223455667', idType: 'national', phone: '66778899' },
    { name: 'شركة التميز للخدمات المكتبية', tenantType: 'company', commercialReg: 'CR-223344', phone: '22446688', email: 'tamayoz@test.kw', address: 'حولي' },
    { name: 'بدر عبدالعزيز العنزي', tenantType: 'individual', idNumber: '295334566778', idType: 'national', phone: '50112244', guarantor: 'عبدالعزيز العنزي', guarantorPhone: '50117766' },
    { name: 'نوال فهد الدوسري', tenantType: 'individual', idNumber: '301445677889', idType: 'national', phone: '66334455' },
    { name: 'مطاعم الذواقة الكويتية', tenantType: 'company', commercialReg: 'CR-334455', phone: '22557799', email: 'thawaga@test.kw', address: 'حولي' },
    { name: 'مشعل راشد الصباح', tenantType: 'individual', idNumber: '288556788990', idType: 'national', phone: '99112233', guarantor: 'راشد الصباح', guarantorPhone: '99118877' },
    { name: 'هند سليمان العجمي', tenantType: 'individual', idNumber: '302667899001', idType: 'national', phone: '55998877' },
    { name: 'شركة البرمجيات المتقدمة', tenantType: 'company', commercialReg: 'CR-445566', phone: '22668800', email: 'advsoft@test.kw', address: 'حولي' },
    { name: 'طلال عادل الفهد', tenantType: 'individual', idNumber: '290778900112', idType: 'national', phone: '51223344', guarantor: 'عادل الفهد', guarantorPhone: '51229933' },
    { name: 'ريم خالد الصقر', tenantType: 'individual', idNumber: '303889011223', idType: 'national', phone: '65334455' },
    { name: 'مؤسسة النخبة للتوريدات', tenantType: 'company', commercialReg: 'CR-556677', phone: '22779911', email: 'nokhba@test.kw', address: 'مدينة الكويت' },
  ];
  const tenants0 = await api('/api/tenants');
  const tmap = {};
  for (const t of tenants0) tmap[t.name] = t;
  for (const x of [...baseTenants, ...tenantDefs]) {
    if (tmap[x.name]) continue;
    tmap[x.name] = await api('/api/tenants', 'POST', x);
  }
  console.log('tenants total:', Object.keys(tmap).length);

  // ---------- 4) العقود: الأساس + الجديد ----------
  const baseContracts = [
    ['شركة النور للتجارة', 'A1', 300, '2026-01-01', '2026-12-31', 'active'],
    ['أحمد خالد العازمي', 'A2', 350, '2026-01-01', '2026-12-31', 'active'],
    ['مؤسسة الخليج للمقاولات', 'B2', 450, '2025-09-01', '2026-08-31', 'active'],
    ['مؤسسة الخليج للمقاولات', 'O1', 600, '2026-01-15', '2026-12-31', 'active'],
    ['فهد سعيد المطيري', 'B1', 400, '2026-08-01', '2027-07-31', 'active'],
    ['يوسف إبراهيم الشمري', 'A3', 400, '2026-10-01', '2027-09-30', 'active'],
  ];
  const contractDefs = [
    ['عبدالله ناصر الحربي', 'S1', 350, '2026-03-01', '2027-02-28', 'active'],
    ['سارة محمد الرشيد', 'S2', 280, '2026-05-01', '2027-04-30', 'active'],
    ['نوال فهد الدوسري', 'S3', 320, '2026-08-01', '2027-07-31', 'active'],
    ['هند سليمان العجمي', 'S4', 300, '2026-09-15', '2027-09-14', 'active'],
    ['بدر عبدالعزيز العنزي', 'J1', 200, '2026-06-01', '2027-05-31', 'active'],
    ['طلال عادل الفهد', 'J2', 220, '2026-01-10', '2026-11-09', 'active'], // ينتهي خلال أيام
    ['شركة التميز للخدمات المكتبية', 'H1', 850, '2026-01-01', '2026-12-31', 'active'],
    ['مطاعم الذواقة الكويتية', 'H2', 700, '2026-04-01', '2027-03-31', 'active'], // متأخرات حالية
    ['شركة البرمجيات المتقدمة', 'H3', 600, '2026-07-01', '2027-06-30', 'active'],
    ['مؤسسة النخبة للتوريدات', 'H4', 550, '2026-10-01', '2027-09-30', 'active'],
    ['مشعل راشد الصباح', 'M1', 500, '2026-02-01', '2027-01-31', 'active'],
    ['ريم خالد الصقر', 'M2', 450, '2026-11-10', '2027-11-09', 'active'], // دفعة مقدمة
    ['مشعل راشد الصباح', 'M3', 480, '2026-11-01', '2027-10-31', 'renewed'], // عقد مجدد حديثًا
    ['عبدالله ناصر الحربي', 'J3', 180, '2025-06-01', '2026-05-31', 'expired'], // منتهي — أداء كامل
  ];
  const contracts0 = await api('/api/contracts');
  const cmap = {}; // مفتاح: tenantId|unitId
  for (const c of contracts0) cmap[`${c.tenantId}|${c.unitId}`] = c;
  const oldUnits = await api('/api/units');
  const unitByNumber = {};
  for (const u of oldUnits) unitByNumber[u.number] = u;
  for (const [tname, unum, rent, start, end, status] of [...baseContracts, ...contractDefs]) {
    const key = `${tmap[tname].id}|${unitByNumber[unum].id}`;
    if (cmap[key]) continue;
    cmap[key] = await api('/api/contracts', 'POST', {
      unitId: unitByNumber[unum].id, tenantId: tmap[tname].id,
      rentAmount: rent, startDate: start, endDate: end, deposit: rent, status,
    });
  }
  console.log('contracts total:', Object.keys(cmap).length);

  // خريطة عقود بالاسم المختصر للدفعات
  const C = {
    nourA1: cmap[`${tmap['شركة النور للتجارة'].id}|${unitByNumber['A1'].id}`],
    ahmadA2: cmap[`${tmap['أحمد خالد العازمي'].id}|${unitByNumber['A2'].id}`],
    gulfB2: cmap[`${tmap['مؤسسة الخليج للمقاولات'].id}|${unitByNumber['B2'].id}`],
    gulfO1: cmap[`${tmap['مؤسسة الخليج للمقاولات'].id}|${unitByNumber['O1'].id}`],
    fahadB1: cmap[`${tmap['فهد سعيد المطيري'].id}|${unitByNumber['B1'].id}`],
    yousefA3: cmap[`${tmap['يوسف إبراهيم الشمري'].id}|${unitByNumber['A3'].id}`],
    abdullahS1: cmap[`${tmap['عبدالله ناصر الحربي'].id}|${unitByNumber['S1'].id}`],
    saraS2: cmap[`${tmap['سارة محمد الرشيد'].id}|${unitByNumber['S2'].id}`],
    nawalS3: cmap[`${tmap['نوال فهد الدوسري'].id}|${unitByNumber['S3'].id}`],
    hindS4: cmap[`${tmap['هند سليمان العجمي'].id}|${unitByNumber['S4'].id}`],
    badrJ1: cmap[`${tmap['بدر عبدالعزيز العنزي'].id}|${unitByNumber['J1'].id}`],
    talalJ2: cmap[`${tmap['طلال عادل الفهد'].id}|${unitByNumber['J2'].id}`],
    tamayozH1: cmap[`${tmap['شركة التميز للخدمات المكتبية'].id}|${unitByNumber['H1'].id}`],
    thawagaH2: cmap[`${tmap['مطاعم الذواقة الكويتية'].id}|${unitByNumber['H2'].id}`],
    advsoftH3: cmap[`${tmap['شركة البرمجيات المتقدمة'].id}|${unitByNumber['H3'].id}`],
    nokhbaH4: cmap[`${tmap['مؤسسة النخبة للتوريدات'].id}|${unitByNumber['H4'].id}`],
    mushalM1: cmap[`${tmap['مشعل راشد الصباح'].id}|${unitByNumber['M1'].id}`],
    reemM2: cmap[`${tmap['ريم خالد الصقر'].id}|${unitByNumber['M2'].id}`],
    mushalM3: cmap[`${tmap['مشعل راشد الصباح'].id}|${unitByNumber['M3'].id}`],
  };

  // ---------- 5) الدفعات ----------
  // [عقد، شهر، مبلغ، استحقاق، دفع، حالة، طريقة] — شهر null = بدون شهر محدد (مقدم)
  const payDefs = [
    // النور A1: التزام مثالي
    ['nourA1', '2026-08', 300, md('2026-08', 1), md('2026-07', 28), 'paid', 'knet'],
    ['nourA1', '2026-09', 300, md('2026-09', 1), md('2026-09', 1), 'paid', 'knet'],
    ['nourA1', '2026-10', 300, md('2026-10', 1), md('2026-09', 29), 'paid', 'knet'],
    ['nourA1', '2026-11', 300, md('2026-11', 1), md('2026-11', 1), 'paid', 'knet'],
    // أحمد A2: متأخر باستمرار — نوفمبر غير مدفوع (متأخر حالي)
    ['ahmadA2', '2026-09', 350, md('2026-09', 1), md('2026-09', 9), 'paid', 'cash'],
    ['ahmadA2', '2026-10', 350, md('2026-10', 1), md('2026-10', 5), 'paid', 'cash'],
    // الخليج B2 + O1: شركة منتظمة
    ['gulfB2', '2026-09', 450, md('2026-09', 1), md('2026-09', 1), 'paid', 'transfer'],
    ['gulfB2', '2026-10', 450, md('2026-10', 1), md('2026-10', 1), 'paid', 'transfer'],
    ['gulfB2', '2026-11', 450, md('2026-11', 1), md('2026-11', 2), 'paid', 'transfer'],
    ['gulfO1', '2026-09', 600, md('2026-09', 1), md('2026-09', 1), 'paid', 'transfer'],
    ['gulfO1', '2026-10', 600, md('2026-10', 1), md('2026-10', 1), 'paid', 'transfer'],
    ['gulfO1', '2026-11', 600, md('2026-11', 1), md('2026-11', 2), 'paid', 'transfer'],
    // فهد B1: جزئي ثم متأخر ثم جزئي
    ['fahadB1', '2026-09', 250, md('2026-09', 1), md('2026-09', 3), 'paid', 'cash'],
    ['fahadB1', '2026-10', 400, md('2026-10', 1), md('2026-10', 12), 'paid', 'cash'],
    ['fahadB1', '2026-11', 200, md('2026-11', 1), md('2026-11', 2), 'paid', 'cash'],
    // يوسف A3: مختلط (بدأ أكتوبر)
    ['yousefA3', '2026-10', 400, md('2026-10', 1), md('2026-10', 1), 'paid', 'knet'],
    // عبدالله S1: مثالي 4 شهور
    ['abdullahS1', '2026-08', 350, md('2026-08', 1), md('2026-07', 30), 'paid', 'transfer'],
    ['abdullahS1', '2026-09', 350, md('2026-09', 1), md('2026-09', 1), 'paid', 'transfer'],
    ['abdullahS1', '2026-10', 350, md('2026-10', 1), md('2026-10', 1), 'paid', 'transfer'],
    ['abdullahS1', '2026-11', 350, md('2026-11', 1), md('2026-11', 1), 'paid', 'transfer'],
    // سارة S2: متأخرة عادة
    ['saraS2', '2026-09', 280, md('2026-09', 1), md('2026-09', 10), 'paid', 'knet'],
    ['saraS2', '2026-10', 280, md('2026-10', 1), md('2026-10', 6), 'paid', 'knet'],
    ['saraS2', '2026-11', 280, md('2026-11', 1), md('2026-11', 1), 'paid', 'knet'],
    // نوال S3: منتظمة + دفعة مقدمة (نوفمبر+ديسمبر)
    ['nawalS3', '2026-09', 320, md('2026-09', 1), md('2026-09', 1), 'paid', 'knet'],
    ['nawalS3', '2026-10', 320, md('2026-10', 1), md('2026-10', 1), 'paid', 'knet'],
    ['nawalS3', null, 640, md('2026-11', 1), md('2026-11', 1), 'advance', 'knet'],
    // هند S4: جديدة دفعت في الوقت
    ['hindS4', '2026-10', 300, md('2026-10', 1), md('2026-10', 1), 'paid', 'cash'],
    ['hindS4', '2026-11', 300, md('2026-11', 1), md('2026-11', 1), 'paid', 'cash'],
    // بدر J1: جزئيات متكررة
    ['badrJ1', '2026-09', 120, md('2026-09', 1), md('2026-09', 5), 'paid', 'cash'],
    ['badrJ1', '2026-10', 200, md('2026-10', 1), md('2026-10', 1), 'paid', 'cash'],
    ['badrJ1', '2026-11', 100, md('2026-11', 1), md('2026-11', 4), 'paid', 'cash'],
    // طلال J2: منتظم حتى أكتوبر — نوفمبر غير مدفوع
    ['talalJ2', '2026-08', 220, md('2026-08', 1), md('2026-08', 1), 'paid', 'cash'],
    ['talalJ2', '2026-09', 220, md('2026-09', 1), md('2026-09', 1), 'paid', 'cash'],
    ['talalJ2', '2026-10', 220, md('2026-10', 1), md('2026-10', 2), 'paid', 'cash'],
    // التميز H1: مثالي
    ['tamayozH1', '2026-08', 850, md('2026-08', 1), md('2026-08', 1), 'paid', 'cheque'],
    ['tamayozH1', '2026-09', 850, md('2026-09', 1), md('2026-09', 1), 'paid', 'cheque'],
    ['tamayozH1', '2026-10', 850, md('2026-10', 1), md('2026-10', 1), 'paid', 'cheque'],
    ['tamayozH1', '2026-11', 850, md('2026-11', 1), md('2026-11', 1), 'paid', 'cheque'],
    // الذواقة H2: متأخرات حالية — سبتمبر متأخر مدفوع، أكتوبر ونوفمبر غير مدفوعين
    ['thawagaH2', '2026-09', 700, md('2026-09', 1), md('2026-09', 15), 'paid', 'cheque'],
    // البرمجيات H3: منتظمة مع تأخير بسيط
    ['advsoftH3', '2026-09', 600, md('2026-09', 1), md('2026-09', 1), 'paid', 'transfer'],
    ['advsoftH3', '2026-10', 600, md('2026-10', 1), md('2026-10', 7), 'paid', 'transfer'],
    ['advsoftH3', '2026-11', 600, md('2026-11', 1), md('2026-11', 1), 'paid', 'transfer'],
    // النخبة H4: دفعت مقدّمًا
    ['nokhbaH4', '2026-10', 550, md('2026-10', 1), md('2026-09', 28), 'paid', 'cheque'],
    ['nokhbaH4', '2026-11', 550, md('2026-11', 1), md('2026-11', 1), 'paid', 'cheque'],
    // مشعل M1: مثالي
    ['mushalM1', '2026-08', 500, md('2026-08', 1), md('2026-08', 1), 'paid', 'transfer'],
    ['mushalM1', '2026-09', 500, md('2026-09', 1), md('2026-09', 1), 'paid', 'transfer'],
    ['mushalM1', '2026-10', 500, md('2026-10', 1), md('2026-10', 1), 'paid', 'transfer'],
    ['mushalM1', '2026-11', 500, md('2026-11', 1), md('2026-11', 1), 'paid', 'transfer'],
    // ريم M2: دفعة مقدمة شهرين (عقد يبدأ 10 نوفمبر)
    ['reemM2', null, 900, md('2026-11', 10), md('2026-11', 3), 'advance', 'knet'],
    // مشعل M3 المجدد: نوفمبر مدفوع
    ['mushalM3', '2026-11', 480, md('2026-11', 1), md('2026-11', 1), 'paid', 'transfer'],
  ];
  const payments0 = await api('/api/payments');
  const pkey = (p) => `${p.contractId}|${p.month || ''}`;
  const pmap = new Set(payments0.map(pkey));
  let payCount = 0;
  for (const [ck, month, amount, dueDate, paidDate, status, method] of payDefs) {
    const k = `${C[ck].id}|${month || ''}`;
    if (pmap.has(k)) continue;
    await api('/api/payments', 'POST', {
      contractId: C[ck].id, amount, dueDate, paidDate,
      month: month || undefined, status, method,
      notes: 'بيانات اختبار',
    });
    payCount++;
  }
  console.log('payments created:', payCount);

  // ---------- 6) الصيانة ----------
  const maintDefs = [
    { title: 'تسرب مياه في حمام المكتب', category: 'plumbing', priority: 'high', status: 'in_progress', unitId: unitByNumber['H1'].id, buildingId: bmap['H-005'].id, estimatedCost: 80, description: 'تسرب من مواسير الحمام الرئيسية' },
    { title: 'المكيف المركزي متوقف', category: 'ac', priority: 'high', status: 'open', unitId: unitByNumber['M1'].id, buildingId: bmap['M-006'].id, estimatedCost: 60, description: 'يحتاج شحن فريون وتنظيف فلاتر' },
    { title: 'المصعد متوقف عن العمل', category: 'elevator', priority: 'urgent', status: 'in_progress', buildingId: bmap['S-003'].id, estimatedCost: 150, description: 'صيانة المصعد الدورية عطلت الوحدات العليا' },
    { title: 'تغيير سخان مياه', category: 'plumbing', priority: 'medium', status: 'completed', unitId: unitByNumber['A2'].id, buildingId: bmap['B-001'].id, cost: 25, estimatedCost: 25, description: 'سخان قديم تالف' },
    { title: 'إصلاح لوحة الكهرباء', category: 'electrical', priority: 'medium', status: 'completed', unitId: unitByNumber['J1'].id, buildingId: bmap['J-004'].id, cost: 40, estimatedCost: 45, description: 'قاطع رئيسي يحترق' },
    { title: 'عقد تنظيف شامل للمشتركات', category: 'cleaning', priority: 'low', status: 'completed', buildingId: bmap['F-002'].id, cost: 90, estimatedCost: 90, description: 'تنظيف السطح والمداخل والمصعد' },
    { title: 'دهان شقة قبل تسليمها', category: 'civil', priority: 'low', status: 'open', unitId: unitByNumber['B2'].id, buildingId: bmap['F-002'].id, estimatedCost: 120, description: 'بعد خروج المستأجر السابق' },
  ];
  for (const m of maintDefs) await api('/api/maintenance', 'POST', m);
  console.log('maintenance:', maintDefs.length);

  // ---------- 7) القضايا والمخالفات ----------
  const caseDefs = [
    { title: 'مخالفة بلدية — لوحة إعلانية بدون تصريح', type: 'municipal', buildingId: bmap['F-002'].id, status: 'open', filedDate: '2026-10-20', amount: 100, description: 'بلدية الفروانية رصدت لوحة إعلانية على الواجهة', reference: 'MUN-2026-331' },
    { title: 'قضية إخلاء — عدم سداد الإيجار', type: 'lawsuit', buildingId: bmap['H-005'].id, unitId: unitByNumber['H2'].id, tenantId: tmap['مطاعم الذواقة الكويتية'].id, status: 'in_progress', filedDate: '2026-10-05', hearingDate: '2026-11-15', amount: 1400, description: 'إخلاء الوحدة وتحصيل المتأخرات (شهران)', reference: 'CASE-2026-118' },
    { title: 'مخالفة إشغال الرصيف', type: 'municipal', buildingId: bmap['H-005'].id, status: 'paid', filedDate: '2026-08-12', amount: 50, description: 'طاولات خارج المحل تسد الرصيف', reference: 'MUN-2026-215' },
    { title: 'قضية تحصيل سابقة — منتهية', type: 'lawsuit', buildingId: bmap['B-001'].id, status: 'closed', filedDate: '2026-03-01', amount: 350, description: 'تم التحصيل بالكامل وإغلاق القضية', reference: 'CASE-2025-067' },
  ];
  for (const cse of caseDefs) await api('/api/legal-cases', 'POST', cse);
  console.log('legal cases:', caseDefs.length);

  // ---------- 8) الحركات المالية ----------
  // كهرباء و مياه شهري لكل عمارة (سبتمبر/أكتوبر/نوفمبر)
  const utilityDefs = [
    ['B-001', 55], ['F-002', 75], ['S-003', 60], ['J-004', 30], ['H-005', 120], ['M-006', 65],
  ];
  let txCount = 0;
  for (const [bc, base] of utilityDefs) {
    for (const [m, mult] of [['2026-09', 1], ['2026-10', 1.1], ['2026-11', 0.9]]) {
      await api('/api/transactions', 'POST', {
        date: md(m, 25), buildingId: bmap[bc].id, type: 'expense',
        category: 'كهرباء ومياه', amount: Math.round(base * mult), cashAccount: 'cash',
      });
      txCount++;
    }
  }
  // حركة إيراد: غرامة تأخير
  await api('/api/transactions', 'POST', { date: '2026-11-02', buildingId: bmap['F-002'].id, type: 'income', category: 'غرامة تأخير', amount: 25, cashAccount: 'cash' });
  txCount++;
  // مصروف إداري موزع بنسبة الإيجار (رواتب إدارية)
  await api('/api/transactions', 'POST', { date: '2026-11-01', type: 'expense', category: 'رواتب إدارية', amount: 300, distribute: { mode: 'rent' }, cashAccount: 'cash' });
  txCount++;
  // مصروف إداري موزع بالتساوي (أمن وحراسة)
  await api('/api/transactions', 'POST', { date: '2026-10-01', type: 'expense', category: 'أمن وحراسة', amount: 200, distribute: { mode: 'equal' }, cashAccount: 'cash' });
  txCount++;
  console.log('transactions:', txCount);

  // ---------- 9) القروض والأقساط ----------
  const loan1 = await api('/api/loans', 'POST', { name: 'قرض بنك الكويت الوطني — تجديد المصاعد', buildingId: bmap['F-002'].id, principal: 5000, rate: 6, months: 24, date: '2026-06-01' });
  const loan2 = await api('/api/loans', 'POST', { name: 'قرض تجهيزات مجمع حولي', buildingId: bmap['H-005'].id, principal: 2000, rate: 4.5, months: 12, date: '2026-09-01' });
  // أقساط: قرض1 ثلاثة أقساط (208 أصل + 25 فائدة)، قرض2 قسطان (167 أصل + 7.5 فائدة)
  const lpDefs = [
    [loan1.id, '2026-07-01', 208, 25], [loan1.id, '2026-08-01', 208, 25], [loan1.id, '2026-09-01', 208, 25],
    [loan2.id, '2026-10-01', 167, 8], [loan2.id, '2026-11-01', 167, 8],
  ];
  for (const [loanId, date, principal, interest] of lpDefs) await api('/api/loan-payments', 'POST', { loanId, date, principal, interest });
  console.log('loans: 2, installments:', lpDefs.length);

  // ---------- 10) حالات الوحدات ----------
  const rentedNums = ['S1', 'S2', 'S3', 'S4', 'J1', 'J2', 'J3', 'H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3'];
  for (const n of rentedNums) await api(`/api/units/${unitByNumber[n].id}`, 'PUT', { status: 'rented' });
  await api(`/api/units/${unitByNumber['S6'].id}`, 'PUT', { status: 'maintenance' }); // تحت الصيانة
  await api(`/api/units/${unitByNumber['M4'].id}`, 'PUT', { status: 'reserved' });   // محجوزة
  // الشاغرة: S5, S7, S8, J4, J5, J6, H5, H6, M5, M6 (تظل available)

  console.log('BIG SEED DONE ✓');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
