'use client';
// =============================================================
// مستندات الطباعة — سندات القبض والصرف + إذن القيد + دفتر اليومية + ميزان المراجعة
// الطباعة عبر iframe معزول (لا تتأثر واجهة التطبيق) + معاينة داخل Dialog قبل الطباعة
// كل النصوص القادمة من قاعدة البيانات تمر على esc() لمنع أي حقن HTML
// =============================================================
import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { tafqitKWD } from '@/lib/tafqit';
import { SOURCE_LABELS } from '@/lib/accounting';

// ---------- أدوات مساعدة ----------
function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt3(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const METHOD_LABELS: Record<string, string> = { cash: 'نقدي', transfer: 'تحويل بنكي', check: 'شيك', card: 'بطاقة / مدى' };
function methodLabel(m?: string | null): string { return METHOD_LABELS[m || ''] || m || 'نقدي'; }

function dateStr(d: any): string {
  if (!d) return new Date().toLocaleDateString('en-GB');
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB');
}

function nowStr(): string {
  return new Date().toLocaleString('ar-EG-u-nu-latn', { hour12: false });
}

// ---------- الشعار المضمّن ----------
const LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="v-logo"><defs><linearGradient id="vlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#vlg)"/><g fill="#ffffff"><rect x="11" y="28" width="11" height="24" rx="1.6" opacity=".92"/><rect x="26" y="15" width="13" height="37" rx="1.6"/><rect x="43" y="32" width="10" height="20" rx="1.6" opacity=".85"/></g><g fill="#fde68a"><rect x="14" y="32" width="2.4" height="2.4"/><rect x="18.4" y="32" width="2.4" height="2.4"/><rect x="14" y="37" width="2.4" height="2.4"/><rect x="18.4" y="37" width="2.4" height="2.4"/><rect x="14" y="42" width="2.4" height="2.4"/><rect x="18.4" y="42" width="2.4" height="2.4"/><rect x="29" y="20" width="2.4" height="2.4"/><rect x="33.6" y="20" width="2.4" height="2.4"/><rect x="29" y="25" width="2.4" height="2.4"/><rect x="33.6" y="25" width="2.4" height="2.4"/><rect x="29" y="30" width="2.4" height="2.4"/><rect x="33.6" y="30" width="2.4" height="2.4"/><rect x="29" y="35" width="2.4" height="2.4"/><rect x="33.6" y="35" width="2.4" height="2.4"/><rect x="46" y="36" width="2" height="2"/><rect x="50" y="36" width="2" height="2"/><rect x="46" y="41" width="2" height="2"/><rect x="50" y="41" width="2" height="2"/></g><rect x="29" y="44" width="8.2" height="8" rx="1" fill="#ffffff"/></svg>`;

// ---------- تنسيقات المستند (أسماء الكلاسات كلها vdoc/v-* حتى لا تتعارض مع التطبيق) ----------
const DOC_CSS = `
.vdoc{--vd-accent:#ea580c;--vd-accent2:#d97706;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#1f2937;direction:rtl;padding:8px;}
.vdoc *{box-sizing:border-box;margin:0;padding:0;}
.vdoc .v-sheet{max-width:820px;margin:0 auto;background:#fff;border:2px solid #9ca3af;border-radius:14px;padding:26px 30px;position:relative;box-shadow:0 2px 10px rgba(0,0,0,.06);}
.vdoc .v-sheet::before{content:'';position:absolute;inset:6px;border:1px dashed #d1d5db;border-radius:9px;pointer-events:none;}
.vdoc .v-head{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:2px solid var(--vd-accent);padding-bottom:14px;margin-bottom:14px;position:relative;z-index:1;}
.vdoc .v-brand{display:flex;align-items:center;gap:10px;}
.vdoc .v-logo{width:46px;height:46px;flex-shrink:0;}
.vdoc .v-brand-name{font-size:20px;font-weight:800;color:#c2410c;line-height:1.2;}
.vdoc .v-brand-sub{font-size:11px;color:#6b7280;}
.vdoc .v-titlebox{flex:1;text-align:center;}
.vdoc .v-kind{display:inline-block;font-size:21px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--vd-accent),var(--vd-accent2));padding:5px 26px;border-radius:10px;letter-spacing:.5px;}
.vdoc .v-kind.spend{background:linear-gradient(135deg,#dc2626,#b91c1c);}
.vdoc .v-meta{margin-top:6px;font-size:12px;color:#4b5563;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.vdoc .v-body{position:relative;z-index:1;}
.vdoc .v-row{display:flex;align-items:baseline;gap:10px;padding:6px 4px;border-bottom:1px dotted #e5e7eb;}
.vdoc .v-label{min-width:130px;font-weight:700;color:#6b7280;font-size:13px;flex-shrink:0;}
.vdoc .v-value{flex:1;font-size:15px;font-weight:600;}
.vdoc .v-amount{font-size:20px;font-weight:800;color:#b45309;}
.vdoc .v-words{font-size:14px;font-weight:700;color:#374151;}
.vdoc .v-badge{display:inline-block;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:8px;padding:1px 12px;font-weight:700;font-size:13px;margin-inline-end:8px;}
.vdoc table.v-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;}
.vdoc .v-table th{background:#fff7ed;color:#9a3412;border:1px solid #f3d5b5;padding:7px 8px;font-weight:700;}
.vdoc .v-table td{border:1px solid #e5e7eb;padding:6px 8px;text-align:center;}
.vdoc .v-table td.r{text-align:right;}
.vdoc .v-table .num{font-variant-numeric:tabular-nums;font-weight:700;}
.vdoc .v-table tfoot td{background:#fef3c7;font-weight:800;border-top:2px solid #f59e0b;}
.vdoc .v-note{margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#92400e;}
.vdoc .v-sigs{display:flex;justify-content:space-between;gap:20px;margin-top:44px;position:relative;z-index:1;}
.vdoc .v-sig{flex:1;text-align:center;font-size:12px;color:#4b5563;font-weight:700;}
.vdoc .v-sig .line{border-top:2px dotted #9ca3af;margin-bottom:6px;}
.vdoc .v-foot{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:10.5px;color:#9ca3af;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;position:relative;z-index:1;}
@media print{ .vdoc{padding:0;} .vdoc .v-sheet{border-color:#6b7280;border-radius:0;max-width:none;margin:0;box-shadow:none!important;} }
`;

const PRINT_FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">';

/**
 * طباعة مستند عبر iframe معزول — لا يمس واجهة التطبيق إطلاقًا
 * innerHtml يتضمن <style> المستند نفسه
 */
export function printHtmlDoc(innerHtml: string, docTitle = 'مستند') {
  if (typeof window === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = docTitle;
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* المتصفح رفض — نترك الإطار */ }
    setTimeout(() => iframe.remove(), 2000);
  };
  iframe.onload = doPrint;
  try {
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>${esc(docTitle)}</title>${PRINT_FONT_LINK}</head><body style="margin:0;background:#fff">${innerHtml}</body></html>`);
      doc.close();
    }
  } catch { /* ignore */ }
  // احتياط لو حدث onload قبل اكتمال الكتابة أو لم يُطلق أصلًا
  setTimeout(doPrint, 500);
}

// ---------- مواصفة السند العام ----------
export interface VoucherSpec {
  kind: 'قبض' | 'صرف';
  docNumber: string;
  date: string;
  partyLabel: string; // استلمنا من / صرفنا إلى
  party: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  details: Array<[string, string]>;
  notes?: string | null;
  copyLabel?: string;
}

/** سند قبض / سند صرف — المستند القياسي */
export function voucherDocHtml(spec: VoucherSpec, currency = 'د.ك'): string {
  const isReceipt = spec.kind === 'قبض';
  const rows = spec.details.map(([k, v]) =>
    `<div class="v-row"><span class="v-label">${esc(k)}</span><span class="v-value">${esc(v)}</span></div>`).join('');
  return `<style>${DOC_CSS}</style>
<div class="vdoc"><div class="v-sheet">
  <div class="v-head">
    <div class="v-brand">${LOGO_SVG}<div><div class="v-brand-name">PropertyHub</div><div class="v-brand-sub">نظام إدارة الأملاك والعقارات</div></div></div>
    <div class="v-titlebox">
      <div class="v-kind${isReceipt ? '' : ' spend'}">سند ${esc(spec.kind)}</div>
      <div class="v-meta"><span>رقم: <b>${esc(spec.docNumber)}</b></span><span>التاريخ: <b>${esc(dateStr(spec.date))}</b></span></div>
    </div>
  </div>
  <div class="v-body">
    <div class="v-row"><span class="v-label">${esc(spec.partyLabel)}</span><span class="v-value">${esc(spec.party)}</span></div>
    <div class="v-row"><span class="v-label">مبلغ</span><span class="v-value v-amount">${fmt3(spec.amount)} ${esc(currency)}</span></div>
    <div class="v-row"><span class="v-label">فقط لا غير</span><span class="v-value v-words">${esc(tafqitKWD(spec.amount))}</span></div>
    <div class="v-row"><span class="v-label">طريقة الدفع</span><span class="v-value"><span class="v-badge">${esc(methodLabel(spec.method))}</span>${spec.reference ? `مرجع: <b>${esc(spec.reference)}</b>` : ''}</span></div>
    ${rows}
    ${spec.notes ? `<div class="v-row"><span class="v-label">ملاحظات</span><span class="v-value">${esc(spec.notes)}</span></div>` : ''}
  </div>
  <div class="v-sigs">
    <div class="v-sig"><div class="line"></div>${isReceipt ? 'المستلم' : 'المستفيد'}</div>
    <div class="v-sig"><div class="line"></div>أمين الصندوق</div>
    <div class="v-sig"><div class="line"></div>${isReceipt ? 'الدافع' : 'المسلِّم'}</div>
    <div class="v-sig"><div class="line"></div>المدير</div>
  </div>
  <div class="v-foot"><span>${esc(spec.copyLabel || 'نسخة المكتب')}</span><span>أُنشئ آليًا بواسطة نظام PropertyHub — طُبع في ${esc(nowStr())}</span></div>
</div></div>`;
}

// ---------- بنّائو السندات من بيانات النظام ----------

/** سند قبض — تحصيل إيجار */
export function paymentReceiptHtml(p: any, currency = 'د.ك'): string {
  const c = p.contract || {};
  const unit = c.unit?.number ? `وحدة ${c.unit.number}` : '';
  const bld = c.unit?.building?.name || '';
  const about = `إيجار${p.month ? ` شهر ${p.month}` : ''}${unit ? ` — ${unit}` : ''}${bld ? ` — ${bld}` : ''}`;
  return voucherDocHtml({
    kind: 'قبض',
    docNumber: `ق-${String(p.id || '').slice(-8).toUpperCase()}`,
    date: p.paidDate || p.dueDate || new Date(),
    partyLabel: 'استلمنا من',
    party: c.tenant?.name || '-',
    amount: Number(p.amount) || 0,
    method: p.method,
    reference: p.reference,
    details: [
      ['وذلك عن', about],
      ['حالة السداد', p.status === 'partial' ? 'دفعة جزئية — لا تغطي كامل الاستحقاق' : 'مسددة بالكامل'],
      ['العقد', `#${String(p.contractId || '').slice(-8).toUpperCase()}`],
    ],
    notes: p.notes,
    copyLabel: 'نسخة المستأجر',
  }, currency);
}

/** سند قبض — استلام مبلغ قرض */
export function loanReceiptHtml(loan: any, currency = 'د.ك'): string {
  const about = `استلام مبلغ قرض${loan.months ? ` — المدة ${loan.months} شهر` : ''}${loan.rate ? ` — فائدة سنوية ${loan.rate}%` : ''}`;
  return voucherDocHtml({
    kind: 'قبض',
    docNumber: `ق-${String(loan.id || '').slice(-8).toUpperCase()}`,
    date: loan.date || new Date(),
    partyLabel: 'استلمنا من',
    party: loan.name || '-',
    amount: Number(loan.principal) || 0,
    method: 'transfer',
    details: [['وذلك عن', about]],
    notes: null,
    copyLabel: 'نسخة المكتب',
  }, currency);
}

/** سند صرف — سداد قسط قرض (أصل + فوائد) */
export function loanPaymentVoucherHtml(lp: any, loanName: string, currency = 'د.ك'): string {
  const principal = Number(lp.principal) || 0;
  const interest = Number(lp.interest) || 0;
  return voucherDocHtml({
    kind: 'صرف',
    docNumber: `ص-${String(lp.id || '').slice(-8).toUpperCase()}`,
    date: lp.date || new Date(),
    partyLabel: 'صرفنا إلى',
    party: loanName || '-',
    amount: principal + interest,
    method: 'transfer',
    details: [
      ['وذلك عن', 'سداد قسط قرض'],
      ['منها أصل القرض', `${fmt3(principal)} ${currency}`],
      ['ومنها فوائد', `${fmt3(interest)} ${currency}`],
    ],
    notes: lp.notes,
    copyLabel: 'نسخة المكتب',
  }, currency);
}

/** سند صرف — تكلفة صيانة مكتملة */
export function maintenanceVoucherHtml(m: any, currency = 'د.ك'): string {
  const unit = m.unit?.number ? ` — وحدة ${m.unit.number}` : '';
  const bld = m.unit?.building?.name ? ` — ${m.unit.building.name}` : '';
  return voucherDocHtml({
    kind: 'صرف',
    docNumber: `ص-${String(m.id || '').slice(-8).toUpperCase()}`,
    date: m.completedAt || new Date(),
    partyLabel: 'صرفنا إلى',
    party: m.assignedTo || 'جهة التنفيذ',
    amount: Number(m.cost) || 0,
    method: 'cash',
    details: [['وذلك عن', `أعمال صيانة: ${m.title || ''}${unit}${bld}`]],
    notes: m.description,
    copyLabel: 'نسخة المكتب',
  }, currency);
}

/** سند — حركة مالية (إيراد = قبض / مصروف = صرف) */
export function transactionVoucherHtml(t: any, currency = 'د.ك'): string {
  const isIncome = t.type === 'income';
  const bld = t.building?.name ? ` — ${t.building.name}` : '';
  return voucherDocHtml({
    kind: isIncome ? 'قبض' : 'صرف',
    docNumber: `${isIncome ? 'ق' : 'ص'}-${String(t.id || '').slice(-8).toUpperCase()}`,
    date: t.date || new Date(),
    partyLabel: isIncome ? 'استلمنا من' : 'صرفنا إلى',
    party: `${t.category || 'حركة مالية'}${bld}`,
    amount: Number(t.amount) || 0,
    method: t.cashAccount === 'bank' ? 'transfer' : 'cash',
    details: [['وذلك عن', t.category || 'حركة مالية']],
    notes: null,
    copyLabel: 'نسخة المكتب',
  }, currency);
}

// ---------- إذن القيد المحاسبي ----------
export function journalEntryDocHtml(entry: any, currency = 'د.ك'): string {
  const lines: any[] = Array.isArray(entry.lines) ? entry.lines : [];
  const td = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const tc = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const rows = lines.map((l, i) =>
    `<tr><td>${i + 1}</td><td class="num">${esc(l.accountCode)}</td><td class="r">${esc(l.accountName)}</td><td class="num">${l.debit ? fmt3(l.debit) : ''}</td><td class="num">${l.credit ? fmt3(l.credit) : ''}</td></tr>`).join('');
  const src = entry.source && entry.source !== 'manual' ? (SOURCE_LABELS[entry.source] || 'تلقائي') : 'يدوي';
  return `<style>${DOC_CSS}</style>
<div class="vdoc"><div class="v-sheet">
  <div class="v-head">
    <div class="v-brand">${LOGO_SVG}<div><div class="v-brand-name">PropertyHub</div><div class="v-brand-sub">نظام إدارة الأملاك والعقارات</div></div></div>
    <div class="v-titlebox">
      <div class="v-kind">إذن قيد محاسبي</div>
      <div class="v-meta"><span>رقم: <b>${esc(String(entry.id || '').slice(-8).toUpperCase())}</b></span><span>التاريخ: <b>${esc(dateStr(entry.date))}</b></span><span>المصدر: <b>${esc(src)}</b></span></div>
    </div>
  </div>
  <div class="v-body">
    <div class="v-row"><span class="v-label">البيان</span><span class="v-value">${esc(entry.description || '')}</span></div>
    ${entry.building?.name ? `<div class="v-row"><span class="v-label">العمارة</span><span class="v-value">${esc(entry.building.name)}</span></div>` : ''}
    <table class="v-table">
      <thead><tr><th style="width:36px">#</th><th style="width:90px">كود الحساب</th><th>اسم الحساب</th><th style="width:110px">مدين (${esc(currency)})</th><th style="width:110px">دائن (${esc(currency)})</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">الإجمالي</td><td class="num">${fmt3(td)}</td><td class="num">${fmt3(tc)}</td></tr></tfoot>
    </table>
    <div class="v-note">القيد متوازن: مجموع المدين = مجموع الدائن = ${fmt3(td)} ${esc(currency)}</div>
  </div>
  <div class="v-sigs">
    <div class="v-sig"><div class="line"></div>المحاسب</div>
    <div class="v-sig"><div class="line"></div>المراجع</div>
    <div class="v-sig"><div class="line"></div>المدير المالي</div>
  </div>
  <div class="v-foot"><span>أُنشئ آليًا بواسطة نظام PropertyHub</span><span>طُبع في ${esc(nowStr())}</span></div>
</div></div>`;
}

// ---------- دفتر اليومية (كل القيود المعروضة) ----------
export function journalBookDocHtml(entries: any[], currency = 'د.ك', title = 'دفتر اليومية'): string {
  const blocks = entries.map((entry: any) => {
    const lines: any[] = Array.isArray(entry.lines) ? entry.lines : [];
    const rows = lines.map(l =>
      `<tr><td class="num">${esc(l.accountCode)}</td><td class="r">${esc(l.accountName)}</td><td class="num">${l.debit ? fmt3(l.debit) : ''}</td><td class="num">${l.credit ? fmt3(l.credit) : ''}</td></tr>`).join('');
    return `<div style="margin-bottom:14px;">
      <div style="font-size:12.5px;font-weight:800;color:#9a3412;margin-bottom:3px;">${esc(dateStr(entry.date))} — ${esc(entry.description || '')}${entry.source && entry.source !== 'manual' ? ` <span style="font-weight:600;color:#6b7280;">(${esc(SOURCE_LABELS[entry.source] || 'تلقائي')})</span>` : ''}</div>
      <table class="v-table"><thead><tr><th style="width:90px">الكود</th><th>الحساب</th><th style="width:110px">مدين</th><th style="width:110px">دائن</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }).join('');
  return `<style>${DOC_CSS}</style>
<div class="vdoc"><div class="v-sheet">
  <div class="v-head">
    <div class="v-brand">${LOGO_SVG}<div><div class="v-brand-name">PropertyHub</div><div class="v-brand-sub">نظام إدارة الأملاك والعقارات</div></div></div>
    <div class="v-titlebox"><div class="v-kind">${esc(title)}</div><div class="v-meta"><span>عدد القيود: <b>${entries.length}</b></span><span>العملة: <b>${esc(currency)}</b></span></div></div>
  </div>
  <div class="v-body">${blocks || '<p style="text-align:center;color:#9ca3af;padding:20px;">لا توجد قيود</p>'}</div>
  <div class="v-foot"><span>أُنشئ آليًا بواسطة نظام PropertyHub</span><span>طُبع في ${esc(nowStr())}</span></div>
</div></div>`;
}

// ---------- ميزان المراجعة ----------
export interface TBRow { code: string; name: string; debit: number; credit: number; bd: number; bc: number; }

export function trialBalanceDocHtml(rows: TBRow[], currency = 'د.ك', asOfDate?: string): string {
  const t = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit, bd: s.bd + r.bd, bc: s.bc + r.bc }), { debit: 0, credit: 0, bd: 0, bc: 0 });
  const body = rows.map(r =>
    `<tr><td class="num">${esc(r.code)}</td><td class="r">${esc(r.name)}</td><td class="num">${r.debit ? fmt3(r.debit) : ''}</td><td class="num">${r.credit ? fmt3(r.credit) : ''}</td><td class="num">${r.bd ? fmt3(r.bd) : ''}</td><td class="num">${r.bc ? fmt3(r.bc) : ''}</td></tr>`).join('');
  return `<style>${DOC_CSS}</style>
<div class="vdoc"><div class="v-sheet">
  <div class="v-head">
    <div class="v-brand">${LOGO_SVG}<div><div class="v-brand-name">PropertyHub</div><div class="v-brand-sub">نظام إدارة الأملاك والعقارات</div></div></div>
    <div class="v-titlebox"><div class="v-kind">ميزان المراجعة</div><div class="v-meta">${asOfDate ? `<span>حتى تاريخ: <b>${esc(dateStr(asOfDate))}</b></span>` : ''}<span>العملة: <b>${esc(currency)}</b></span></div></div>
  </div>
  <div class="v-body">
    <table class="v-table">
      <thead><tr><th style="width:90px">الكود</th><th>اسم الحساب</th><th style="width:105px">مدين</th><th style="width:105px">دائن</th><th style="width:105px">رصيد مدين</th><th style="width:105px">رصيد دائن</th></tr></thead>
      <tbody>${body || '<tr><td colspan="6" style="color:#9ca3af;">لا توجد حركات محاسبية</td></tr>'}</tbody>
      <tfoot><tr><td colspan="2">الإجمالي</td><td class="num">${fmt3(t.debit)}</td><td class="num">${fmt3(t.credit)}</td><td class="num">${fmt3(t.bd)}</td><td class="num">${fmt3(t.bc)}</td></tr></tfoot>
    </table>
    <div class="v-note">${Math.round(t.debit * 1000) === Math.round(t.credit * 1000)
      ? 'الميزان متوازن: مجموع الحركات المدينة يساوي الدائنة — دفاتر سليمة'
      : 'تنبيه: الميزان غير متوازن — راجع القيود المسجلة'}</div>
  </div>
  <div class="v-sigs">
    <div class="v-sig"><div class="line"></div>المحاسب</div>
    <div class="v-sig"><div class="line"></div>المراجع</div>
    <div class="v-sig"><div class="line"></div>المدير المالي</div>
  </div>
  <div class="v-foot"><span>أُنشئ آليًا بواسطة نظام PropertyHub</span><span>طُبع في ${esc(nowStr())}</span></div>
</div></div>`;
}

// ---------- حوار المعاينة + الطباعة ----------
export function VoucherDialog({ trigger, title, docHtml }: {
  trigger: React.ReactNode;
  title: string;
  docHtml: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2"><Printer size={18} className="text-orange-600" />{title} — معاينة قبل الطباعة</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 shrink-0 pb-2">
          <Button size="sm" className="bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold" onClick={() => printHtmlDoc(docHtml, title)}>
            <Printer size={14} className="ml-1" />طباعة
          </Button>
        </div>
        <div className="rounded-xl bg-gray-200/70 p-3 overflow-auto flex-1" style={{ minHeight: '200px' }} dangerouslySetInnerHTML={{ __html: docHtml }} />
      </DialogContent>
    </Dialog>
  );
}
