'use client';

// =============================================================
// شريط أدوات Excel لكل صفحة: تصدير + قالب فارغ + معالج استيراد
// المعالج: اختيار ملف → معاينة وتحقق → استيراد مع تقدم مباشر → ملخص نتائج
// الاستيراد ذكي دائمًا (Upsert): الصف الموجود مسبقًا في النظام يتحدّث بمحتوى الملف
// والصف الجديد يُضاف — فرفع نفس الملف أكثر من مرة آمن ولا يكرر البيانات.
// الاستيراد يرسل الصفوف بالتسلسل إلى واجهات النظام نفسها — فتُطبّق كل قواعد
// التحقق وتوليد القيود المحاسبية التلقائية كما لو أُدخلت يدويًا.
// =============================================================
import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileDown, FileSpreadsheet, FileUp, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ENTITIES, IMPORT_ORDER, exportEntity, downloadTemplate, readExcelFile, findExistingMatch, UPDATE_CTX_EXTRA, type ImportCtx } from '@/lib/excel';

const CONFIRM_ORDER: Record<string, string[]> = {
  units: ['buildings'],
  contracts: ['buildings', 'units', 'tenants'],
  payments: ['buildings', 'units', 'tenants', 'contracts'],
  transactions: ['buildings'],
  loans: ['buildings'],
  maintenance: ['buildings', 'units'],
};

const UNIT_STATUS_LABEL: Record<string, string> = { available: 'متاحة', rented: 'مؤجرة', maintenance: 'صيانة', reserved: 'محجوزة' };
const UNIT_STATUS_CHIP: Record<string, string> = { available: 'bg-emerald-100 text-emerald-800', rented: 'bg-blue-100 text-blue-800', maintenance: 'bg-amber-100 text-amber-800', reserved: 'bg-purple-100 text-purple-800' };

/** ملخص حالات الوحدات في صفوف محللة */
function unitStatusSummary(rows: { data?: any }[]): Record<string, number> | null {
  if (!rows.length) return null;
  const counts: Record<string, number> = {};
  rows.forEach(r => { const s = r.data?.status || 'available'; counts[s] = (counts[s] || 0) + 1; });
  return counts;
}

function UnitStatusChips({ counts }: { counts: Record<string, number> | null }) {
  if (!counts) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500 font-semibold">الحالات بعد التحليل:</span>
      {Object.entries(counts).map(([s, n]) => (
        <Badge key={s} className={UNIT_STATUS_CHIP[s] || 'bg-gray-100 text-gray-700'}>{UNIT_STATUS_LABEL[s] || s}: {n}</Badge>
      ))}
      {(counts.rented || 0) === 0 && (
        <span className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">كل الوحدات «متاحة» — لو كانت مؤجرة فعليًا عدّل عمود «الحالة» إلى «مؤجرة» في الملف وأعد الاستيراد (الموجود هيتحدث من غير تكرار)</span>
      )}
    </div>
  );
}

/** تحديث نسخة السياق المحلية بعد الكتابة حتى تطابق الصفوف التالية أحدث حالة (منع تكرار داخل نفس الملف) */
function syncCtxItem(ctx: any, key: string, item: any) {
  if (!item?.id || !Array.isArray(ctx?.[key])) return;
  const i = ctx[key].findIndex((x: any) => x.id === item.id);
  if (i >= 0) ctx[key][i] = { ...ctx[key][i], ...item }; else ctx[key].push(item);
}

async function api<T = any>(url: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = typeof window !== 'undefined' ? localStorage.getItem('sid') : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `فشل الاتصال (${res.status})`);
  return data as T;
}

interface ParsedRow { index: number; ok: boolean; data?: any; error?: string; raw: Record<string, any>; }

export function ExcelToolbar({ entity, rows, canWrite, onImported, importEnabled = true }: {
  entity: string;
  rows: any[];
  canWrite: boolean;
  onImported: () => void;
  importEnabled?: boolean;
}) {
  const def = ENTITIES[entity];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'pick' | 'preview' | 'importing' | 'done'>('pick');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [importStats, setImportStats] = useState({ ok: 0, fail: 0, updated: 0 });
  const [failures, setFailures] = useState<{ index: number; error: string }[]>([]);
  const [busyParse, setBusyParse] = useState(false);
  const [importing, setImporting] = useState(false);
  // الاستيراد ذكي دائمًا: الصف الموجود مسبقًا يتحدّث بمحتوى الملف (بدون تكرار) والصف الجديد يُضاف
  const [ctx, setCtx] = useState<ImportCtx>({ buildings: [], units: [], tenants: [], contracts: [] });
  // تنبيه قلب الحالات: عدد الوحدات المسجلة «مؤجرة» في النظام وسيقلبها الملف إلى غير مؤجرة
  const [rentedFlips, setRentedFlips] = useState(0);
  const [flipConfirmed, setFlipConfirmed] = useState(false);

  if (!def) return null;
  const validRows = parsed.filter(r => r.ok);
  const invalidRows = parsed.filter(r => !r.ok);
  const flipBlocked = entity === 'units' && rentedFlips > 0 && !flipConfirmed;
  const needed = CONFIRM_ORDER[entity] || [];
  const orderHint = needed.length > 0
    ? `تأكد أولاً من وجود بيانات: ${needed.map(k => ENTITIES[k].label).join(' ← ')} (استوردها قبل هذه الورقة)`
    : 'لا يحتاج بيانات مرجعية — يمكنك الاستيراد مباشرة';

  const reset = () => { setStep('pick'); setParsed([]); setFileName(''); setProgress(0); setImportStats({ ok: 0, fail: 0, updated: 0 }); setFailures([]); setRentedFlips(0); setFlipConfirmed(false); setCtx({ buildings: [], units: [], tenants: [], contracts: [] }); };

  // جلب البيانات المرجعية الحالية لحل المراجع + بيانات الكيان نفسه لمطابقة الصفوف بالسجلات الموجودة
  // (المطابقة الذكية: الموجود يتحدّث والجديد يُضاف)
  const fetchCtx = async (): Promise<ImportCtx> => {
    const needs = new Set<string>([...(def.ctxNeeds || []), ...(UPDATE_CTX_EXTRA[entity] || [])]);
    const [b, u, t, c, tx, lo, mt, ac] = await Promise.all([
      needs.has('buildings') ? api('/api/buildings') : Promise.resolve([]),
      needs.has('units') ? api('/api/units') : Promise.resolve([]),
      needs.has('tenants') ? api('/api/tenants') : Promise.resolve([]),
      needs.has('contracts') ? api('/api/contracts') : Promise.resolve([]),
      needs.has('transactions') ? api('/api/transactions') : Promise.resolve([]),
      needs.has('loans') ? api('/api/loans') : Promise.resolve([]),
      needs.has('maintenance') ? api('/api/maintenance') : Promise.resolve([]),
      needs.has('accounts') ? api('/api/accounts') : Promise.resolve([]),
    ]);
    return { buildings: b, units: u, tenants: t, contracts: c, transactions: tx, loans: lo, maintenance: mt, accounts: ac };
  };

  const handleFile = async (file: File) => {
    setBusyParse(true);
    try {
      const { rows: excelRows } = await readExcelFile(file, entity);
      if (excelRows.length === 0) throw new Error('الملف لا يحتوي صفوف بيانات — لو ده القالب الفارغ عبّئ بياناتك فيه ثم أعد الرفع');
      setFileName(file.name);
      let ctxData: ImportCtx = { buildings: [], units: [], tenants: [], contracts: [] };
      try { ctxData = await fetchCtx(); setCtx(ctxData); } catch { /* سياق فارغ — ستفشل المراجع برسائل واضحة */ }
      const seen = new Set<string>();
      const results: ParsedRow[] = excelRows.map((r, i) => {
        try {
          const res = def.parseRow(r, def.columns, ctxData, seen);
          return { index: i + 1, ok: res.ok, data: res.data, error: res.error, raw: r };
        } catch (e: any) {
          return { index: i + 1, ok: false, error: e?.message || 'خطأ غير متوقع', raw: r };
        }
      });
      setParsed(results);
      // احسب كم وحدة مسجلة «مؤجرة» سيتغير حالتها إلى غير مؤجرة بسبب الملف — لعرض تنبيه التأكيد
      if (entity === 'units') {
        const flips = results.filter(r => {
          const d = r.data;
          if (!r.ok || !d || d.status === 'rented') return false;
          const existing = ((ctxData as any).units || []).find((x: any) => x.buildingId === d.buildingId && String(x.number).trim() === String(d.number).trim());
          return existing?.status === 'rented';
        }).length;
        setRentedFlips(flips);
        setFlipConfirmed(false);
      }
      setStep('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر قراءة الملف');
    } finally {
      setBusyParse(false);
    }
  };

  const startImport = async () => {
    setImporting(true);
    setStep('importing');
    let ctxData: ImportCtx = { buildings: [], units: [], tenants: [], contracts: [] };
    try { ctxData = await fetchCtx(); setCtx(ctxData); } catch { /* استمرار بسياق فارغ */ }

    const seen = new Set<string>();
    const todo = validRows;
    let ok = 0, fail = 0, updated = 0;
    const fails: { index: number; error: string }[] = [];
    for (let i = 0; i < todo.length; i++) {
      const row = todo[i];
      try {
        const re = def.parseRow(row.raw, def.columns, ctxData, seen);
        if (!re.ok || !re.data) throw new Error(re.error || 'صف غير صالح');
        // مطابقة ذكية: الموجود يُحدَّث (PUT) والغير موجود يُضاف (POST) — رفع نفس الملف أكثر من مرة آمن بدون تكرار
        const m = findExistingMatch(def.key, re.data, ctxData);
        if (m) {
          const upd = await api(`${def.apiPath}/${m.id}`, 'PUT', re.data);
          updated++;
          syncCtxItem(ctxData as any, def.key, { ...(upd || {}), ...re.data, id: m.id });
        } else {
          const created = await api(def.apiPath, 'POST', re.data);
          ok++;
          syncCtxItem(ctxData as any, def.key, { ...(created || {}), ...re.data });
        }
        if (def.key === 'buildings' && re.data.code) seen.add(re.data.code);
        if (def.key === 'tenants' && re.data.name) seen.add(re.data.name);
        if (def.key === 'accounts' && re.data.code) seen.add(re.data.code);
      } catch (e) {
        fail++;
        fails.push({ index: row.index, error: e instanceof Error ? e.message : 'خطأ' });
      }
      setProgress(Math.round(((i + 1) / todo.length) * 100));
      setImportStats({ ok, fail, updated });
      setFailures([...fails]);
    }
    setImporting(false);
    setStep('done');
    onImported();
  };

  const previewRows = parsed.slice(0, 6);
  // عدّاد ما سيتم — صفوف ستُحدّث مقابل صفوف ستُضاف (المطابقة ذكية دائمًا)
  const updateCounts = validRows.reduce((acc, r) => {
    if (!r.data) return acc;
    if (findExistingMatch(def.key, r.data, ctx)) acc.upd++; else acc.add++;
    return acc;
  }, { upd: 0, add: 0 });

  return (
    <>
      {/* أزرار التصدير والقالب */}
      <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => { exportEntity(entity, rows); toast.success('تم تنزيل ملف الإكسل'); }} disabled={rows.length === 0} title="تصدير البيانات الحالية إلى Excel">
        <FileDown size={16} className="ml-1" />تصدير Excel
      </Button>
      <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => { downloadTemplate(entity); toast.success('تم تنزيل قالب فارغ — عبّئه ثم استورده (بياناتك الموجودة تنزل من زر «تصدير Excel»)'); }} title="قالب فارغ للتعبئة — أعمدته مطابقة للاستيراد، ومفيهوش بياناتك (بياناتك تنزل من تصدير Excel)">
        <FileSpreadsheet size={16} className="ml-1" />قالب فارغ
      </Button>
      {canWrite && importEnabled && (
        <Button variant="outline" size="sm" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => { reset(); setOpen(true); }} title="استيراد بيانات من ملف Excel">
          <FileUp size={16} className="ml-1" />استيراد
        </Button>
      )}

      {/* معالج الاستيراد */}
      <Dialog open={open} onOpenChange={(v) => { if (!importing) { setOpen(v); if (!v) reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-900"><FileUp size={20} />استيراد {def.label} من Excel</DialogTitle>
            <DialogDescription>استورد بياناتك دفعة واحدة بدل الإدخال عنصر عنصر — الموجود يتحدّث والجديد يُضاف</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto -mx-1 px-1">
            {step === 'pick' && (
              <div className="space-y-4 py-2">
                {/* الاستيراد الذكي: تحديث الموجود + إضافة الجديد في تشغيلة واحدة */}
                <div className="p-3 rounded-xl border-2 border-orange-200 bg-orange-50">
                  <p className="text-sm font-bold text-orange-800">استيراد ذكي — الموجود يتحدّث والجديد يُضاف</p>
                  <p className="text-[11px] text-gray-600 mt-1">كل صف في الملف: لو مطابق لسجل موجود في النظام يتحدّث بمحتوى الملف بدون تكرار، ولو جديد يُضاف فورًا — يعني تقدر ترفع نفس الملف كل ما تتغير بياناتك وهو يعرف الموجود ويحدّثه وينزّ الجديد بس.</p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-900">
                  <Info size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p><strong>إيه الفرق؟</strong> «<strong>قالب فارغ</strong>» = ملف Excel فاضي بالأعمدة الصحيحة تعبّيه بنفسك • «<strong>تصدير Excel</strong>» = نسخة ببياناتك الموجودة حاليًا (عدّلها وارفعها هنا — الموجود يتحدّث والجديد يُضاف) • «<strong>استيراد</strong>» = رفع الملف للنظام.</p>
                    <p className="text-xs text-blue-700">ملف القالب فيه ورقة «اقرأني» فيها الشرح — وصف الإرشاد وصف المثال بيتتجاهلوا تلقائيًا عند الرفع.</p>
                    <p className="text-xs text-blue-700">{orderHint}</p>
                    <p className="text-xs text-blue-700">التواريخ تقبل <span dir="ltr">2025-01-31</span> أو <span dir="ltr">31/01/2025</span> — والأرقام عادية أو عربية (٠-٩).</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">مفاتيح المطابقة — العمارات: الكود أو الاسم • الوحدات: العمارة + رقم الوحدة • المستأجرين: الاسم • العقود: نفس الوحدة + نفس التواريخ (أو العقد النشط المتقاطع مع فترة الصف) • المدفوعات: العقد + تاريخ الاستحقاق</p>
                <label className="block">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <div className="border-2 border-dashed border-orange-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-orange-50 transition">
                    {busyParse ? <Loader2 size={32} className="mx-auto text-orange-500 animate-spin" /> : <FileSpreadsheet size={32} className="mx-auto text-orange-400" />}
                    <p className="mt-2 font-semibold text-gray-700">{busyParse ? 'جاري قراءة الملف...' : 'اضغط لاختيار ملف Excel'}</p>
                    <p className="text-xs text-gray-400 mt-1">xlsx / xls / csv — الورقة الأولى هي التي ستُقرأ</p>
                  </div>
                </label>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-3 py-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-gray-100 text-gray-700">{fileName}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 size={12} className="ml-1" />{validRows.length} صف جاهز</Badge>
                  {invalidRows.length > 0 && <Badge className="bg-red-100 text-red-800"><XCircle size={12} className="ml-1" />{invalidRows.length} صف به مشكلة (سيُتجاهل)</Badge>}
                  {updateCounts.upd > 0 && <Badge className="bg-blue-100 text-blue-800">سيتم تحديث: {updateCounts.upd}</Badge>}
                  {updateCounts.add > 0 && <Badge className="bg-teal-100 text-teal-800">سيتم إضافة جديد: {updateCounts.add}</Badge>}
                </div>
                {entity === 'units' && validRows.length > 0 && <UnitStatusChips counts={unitStatusSummary(validRows)} />}

                {entity === 'units' && rentedFlips > 0 && (
                  <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${flipConfirmed ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'}`}>
                    <input type="checkbox" checked={flipConfirmed} onChange={e => setFlipConfirmed(e.target.checked)} className="mt-1 accent-red-600" />
                    <span className="text-sm">
                      <strong className="text-red-800">تنبيه قبل المتابعة:</strong>{' '}
                      <span className="text-red-800">ملفك يقول «متاحة» (أو غير مؤجرة) لـ {rentedFlips} وحدة مسجلة حالياً «مؤجرة» في النظام — لو كملت الاستيراد هتقلب شاغرة وينقص عدّاد المؤجرة ونسبة الإشغال.</span>
                      <span className="block text-xs text-gray-600 mt-1">لو دي حالات إخلاء حقيقية كمّل عادي. لو مش مقصودة، عدّل عمود «الحالة» في الملف إلى «مؤجرة» وارفعه تاني.</span>
                    </span>
                  </label>
                )}

                {validRows.length === 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">لا توجد صفوف صالحة — تأكد من مطابقة أسماء الأعمدة للقالب ونزّل القالب للمقارنة.</div>
                ) : (
                  <>
                    <div className="rounded-xl border overflow-hidden">
                      <div className="overflow-x-auto max-h-56">
                        <Table>
                          <TableHeader><TableRow className="bg-orange-50"><TableHead className="w-10">#</TableHead>{def.columns.map(c => <TableHead key={c.key} className="whitespace-nowrap">{c.header}</TableHead>)}</TableRow></TableHeader>
                          <TableBody>
                            {previewRows.map(r => (
                              <TableRow key={r.index} className={r.ok ? '' : 'bg-red-50'}>
                                <TableCell className="text-xs text-gray-400">{r.index}</TableCell>
                                {def.columns.map(c => (
                                  <TableCell key={c.key} className="text-xs whitespace-nowrap">{String(r.raw[c.header] ?? '') || <span className="text-gray-300">—</span>}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {parsed.length > 6 && <p className="text-xs text-gray-400 p-2 bg-gray-50 border-t">معاينة أول 6 صفوف من {parsed.length}</p>}
                    </div>

                    {invalidRows.length > 0 && (
                      <ScrollArea className="h-28 rounded-xl border border-red-100 bg-red-50 p-2">
                        <div className="space-y-1 text-xs text-red-800">
                          {invalidRows.map(r => <p key={r.index}>• صف {r.index}: {r.error}</p>)}
                        </div>
                      </ScrollArea>
                    )}

                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-900">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <p>الصفوف الصالحة فقط ستُستورد. المدفوعات المستوردة ستولّد قيودها المحاسبية تلقائيًا. الترتيب الموصى به: {IMPORT_ORDER.map(k => ENTITIES[k].label).join(' ← ')}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 'importing' && (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-center gap-2 text-orange-700 font-semibold"><Loader2 size={20} className="animate-spin" />جاري الاستيراد... {progress}%</div>
                <Progress value={progress} className="h-3" />
                <div className="flex justify-center gap-3 text-sm flex-wrap">
                  <Badge className="bg-emerald-100 text-emerald-800">أُضيف جديد: {importStats.ok}</Badge>
                  {importStats.updated > 0 && <Badge className="bg-blue-100 text-blue-800">تم تحديث: {importStats.updated}</Badge>}
                  {importStats.fail > 0 && <Badge className="bg-red-100 text-red-800">فشل: {importStats.fail}</Badge>}
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 size={28} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-900">انتهى الاستيراد</p>
                    <p className="text-sm text-emerald-800">{[
                      importStats.updated > 0 ? `تم تحديث ${importStats.updated} سجل موجود` : '',
                      importStats.ok > 0 ? `أُضيف ${importStats.ok} سجل جديد` : '',
                      importStats.fail > 0 ? `وفشل ${importStats.fail} صف` : '',
                    ].filter(Boolean).join(' — ') || 'لم يتم استيراد أي صف'}.</p>
                  </div>
                </div>
                {entity === 'units' && validRows.length > 0 && <UnitStatusChips counts={unitStatusSummary(validRows)} />}
                {failures.length > 0 && (
                  <ScrollArea className="h-40 rounded-xl border border-red-100 bg-red-50 p-3">
                    <p className="text-xs font-bold text-red-900 mb-1">تفاصيل الصفوف الفاشلة:</p>
                    <div className="space-y-1 text-xs text-red-800">
                      {failures.map(f => <p key={f.index}>• صف {f.index}: {f.error}</p>)}
                    </div>
                  </ScrollArea>
                )}
                <p className="text-xs text-gray-400">ملاحظة: {entity === 'units' ? 'الوحدات الموجودة بنفس رقم العمارة تُحدَّث بياناتها وحالتها تلقائيًا بدون تكرار — أعد استيراد نفس الملف بعد تعديل الحالات لتصحيحها.' : 'المطابقة ذكية — الصف الموجود مسبقًا يتحدّث بمحتوى الملف والصف الجديد يُضاف، فتقدر ترفع نفس الملف بعد كل تعديل بدون تكرار البيانات.'}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-3 border-t">
            {step === 'preview' && validRows.length > 0 ? (
              <Button onClick={startImport} disabled={flipBlocked} title={flipBlocked ? 'أكّد مربع التنبيه الأحمر أعلاه أولاً' : undefined} className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                <FileUp size={16} className="ml-2" />{updateCounts.upd > 0 ? `بدء الاستيراد (تحديث ${updateCounts.upd} + إضافة ${updateCounts.add})` : `بدء استيراد ${validRows.length} صف`}
              </Button>
            ) : <span />}
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={importing}>{step === 'done' ? 'إغلاق' : 'إلغاء'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
