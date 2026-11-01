'use client';

// =============================================================
// بطاقة "مسح البيانات التجريبية" — تُعرض في الإعدادات للمدير الرئيسي فقط
// تحذير أحمر + تأكيد كتابي (كتابة العبارة حرفيًا) + نسخة أمان تلقائية قبل المسح
// =============================================================
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, Trash2, Archive, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const CONFIRM_PHRASE = 'مسح البيانات التجريبية';

export function ResetDemoDataCard({ onDone }: { onDone: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { counts: Record<string, number> }>(null);
  const matches = confirmText.trim() === CONFIRM_PHRASE;

  const doReset = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/reset-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل المسح');
      setResult({ counts: data.counts });
      toast.success('تم مسح البيانات التجريبية — النظام جاهز للعمل الحقيقي');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل المسح');
    } finally {
      setBusy(false);
    }
  };

  const total = result ? Object.values(result.counts).reduce((s: number, n) => s + (n || 0), 0) : 0;

  return (
    <Card className="border-2 border-red-200 shadow-lg max-w-2xl">
      <div className="h-1.5 bg-gradient-to-l from-red-500 to-rose-500" />
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-red-800">
          <ShieldAlert size={22} className="text-red-600" />
          منطقة الخطر — تهيئة النظام للعمل الحقيقي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          هذا الزر يمسح <strong>كل البيانات التجريبية</strong> (العمارات، الوحدات، المستأجرين، العقود، المدفوعات، الصيانة، الحركات المالية، القروض، القيود وشجرة الحسابات)
          لتهيئة النظام للبدء بالبيانات الحقيقية.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="font-bold text-red-800 mb-1">سيُمسح نهائيًا:</p>
            <p className="text-red-700">العمارات • الوحدات • المستأجرين • العقود • المدفوعات • الصيانة • الحركات • القروض • القيود • الحسابات</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="font-bold text-emerald-800 mb-1">سيُحتفظ بـ:</p>
            <p className="text-emerald-700">حسابات المستخدمين وكلمات السر • سجل التدقيق • نقاط الاستعادة (شبكة الأمان)</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
          <Archive size={16} className="shrink-0 mt-0.5" />
          <p>قبل المسح يُنشئ النظام <strong>نسخة أمان تلقائية</strong> في صفحة «نقاط الاستعادة» — يمكنك استرجاع كل شيء منها في أي وقت إذا غيّرت رأيك.</p>
        </div>

        {result && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>تم المسح بنجاح — {total.toLocaleString('ar')} سجل تجريبي حُذف، ونسخة الأمان محفوظة في نقاط الاستعادة.</span>
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="bg-gradient-to-l from-red-600 to-rose-600 text-white shadow-md hover:from-red-700 hover:to-rose-700">
              <Trash2 size={16} className="ml-2" />
              مسح كل البيانات التجريبية
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-800">تأكيد نهائي — لا تراجع بعد المسح</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">سيتم مسح جميع البيانات التجريبية نهائيًا. ستُنشأ نسخة أمان تلقائيًا قبل المسح يمكنك استرجاعها من نقاط الاستعادة.</span>
                <span className="block font-semibold text-gray-900">للتأكيد، اكتب العبارة التالية في الحقل: <span className="font-mono bg-red-50 text-red-800 px-1.5 py-0.5 rounded select-all" dir="rtl">{CONFIRM_PHRASE}</span></span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="اكتب عبارة التأكيد هنا..."
              className="border-red-200 focus:border-red-500"
              dir="rtl"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={!matches || busy}
                onClick={(e) => { e.preventDefault(); doReset(); }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {busy ? 'جاري المسح...' : 'نعم، امسح كل البيانات التجريبية'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
