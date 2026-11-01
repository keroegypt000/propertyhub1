'use client';

// =============================================================
// مكوّنات لوحة التحكم الحية:
//  - AnimatedNumber: عدّاد يتحرك (count-up) مع كل تحديث للبيانات
//  - LiveBadge: مؤشر «مباشر» بنبضة + وقت آخر تحديث
//  - رسوم تفاعلية (Recharts): دائري لحالات الوحدات، أعمدة للعمارات، خط زمني 6 أشهر
// كل الرسوم RTL: المحور الرأسي يمين والأشهر من اليمين لليسار
// =============================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ---------- عدّاد متحرك ----------
export function AnimatedNumber({ value, decimals = 2, suffix = '', prefix = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className="tabular-nums" dir="rtl">
      {prefix}{display.toLocaleString('ar-EG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix && <span className="text-[0.6em] font-semibold text-gray-400">{suffix}</span>}
    </span>
  );
}

// ---------- مؤشر البث الحي ----------
export function LiveBadge({ lastUpdated, onRefresh }: { lastUpdated: Date | null; onRefresh: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 gap-1.5" dir="rtl">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        مباشر — تحديث تلقائي كل دقيقة
      </Badge>
      {lastUpdated && <span className="text-xs text-gray-400">آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}</span>}
      <Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" onClick={onRefresh} title="تحديث الآن">
        <RefreshCw size={15} />
      </Button>
    </div>
  );
}

// ---------- Tooltip عربي ----------
function ArTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="rounded-xl bg-white/95 shadow-xl border border-orange-100 px-3 py-2 text-xs">
      {label != null && <p className="font-bold text-gray-800 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: p.color || p.fill }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-bold">{Number(p.value).toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span> د.ك
        </p>
      ))}
    </div>
  );
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// ---------- 1) دائري: حالات الوحدات ----------
export function UnitsDonutChart({ units }: { units: any[] }) {
  const counts = [
    { name: 'مؤجرة', value: units.filter(u => u.status === 'rented').length, color: '#3b82f6' },
    { name: 'متاحة', value: units.filter(u => u.status === 'available').length, color: '#10b981' },
    { name: 'صيانة', value: units.filter(u => u.status === 'maintenance').length, color: '#f59e0b' },
    { name: 'محجوزة', value: units.filter(u => u.status === 'reserved').length, color: '#8b5cf6' },
  ].filter(d => d.value > 0);
  if (units.length === 0) return null;
  return (
    <div className="w-full h-56" dir="ltr">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={counts} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={2}>
            {counts.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<ArTooltip />} />
          <Legend formatter={(v: string) => <span style={{ color: '#374151', fontSize: 12 }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 2) أعمدة: إيرادات/مصروفات لكل عمارة ----------
export function BuildingsBarChart({ data }: { data: { name: string; إيرادات: number; مصروفات: number }[] }) {
  if (data.length === 0) return null;
  return (
    <div className="w-full h-64" dir="ltr">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-12} textAnchor="end" height={44} />
          <YAxis orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => v.toLocaleString('ar-EG')} />
          <Tooltip content={<ArTooltip />} cursor={{ fill: 'rgba(249,115,22,0.06)' }} />
          <Legend formatter={(v: string) => <span style={{ color: '#374151', fontSize: 12 }}>{v}</span>} />
          <Bar dataKey="إيرادات" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
          <Bar dataKey="مصروفات" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 3) خط زمني: آخر 6 أشهر ----------
export function MonthlyTrendChart({ transactions }: { transactions: any[] }) {
  const now = new Date();
  const buckets: { key: string; name: string; إيرادات: number; مصروفات: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, name: AR_MONTHS[d.getMonth()], إيرادات: 0, مصروفات: 0 });
  }
  for (const t of transactions as any[]) {
    const key = String(t.date || '').slice(0, 7);
    const b = buckets.find(x => x.key === key);
    if (!b) continue;
    if (t.type === 'income') b.إيرادات += Number(t.amount) || 0;
    if (t.type === 'expense') b.مصروفات += Number(t.amount) || 0;
  }
  return (
    <div className="w-full h-64" dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" reversed tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => v.toLocaleString('ar-EG')} />
          <Tooltip content={<ArTooltip />} />
          <Legend formatter={(v: string) => <span style={{ color: '#374151', fontSize: 12 }}>{v}</span>} />
          <Area type="monotone" dataKey="إيرادات" stroke="#10b981" strokeWidth={2.5} fill="url(#gIncome)" />
          <Area type="monotone" dataKey="مصروفات" stroke="#ef4444" strokeWidth={2.5} fill="url(#gExpense)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
