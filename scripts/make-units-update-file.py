#!/usr/bin/env python3
# ملف وحدات لاختبار تحديث كل الحقول + مسح الحقول الفارغة (optText)
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "الوحدات"
headers = ['العمارة', 'رقم الوحدة', 'الطابق', 'المساحة م2', 'النوع', 'الحالة', 'الإيجار الشهري', 'ملاحظات']
ws.append(headers)
for i in range(1, 24):
    row = ['المهبوله 1', i, 1, 100, 'شقة', 'مؤجرة' if i <= 23 else 'متاحة', 250, '']
    if i == 5:
        row[3] = 120          # مساحة معدلة
        row[7] = 'ملاحظة قديمة للوحدة 5'
    if i == 7:
        row[6] = 275          # إيجار معدل
    ws.append(row)
wb.save('/tmp/وحدات-تحديث.xlsx')
print('saved /tmp/وحدات-تحديث.xlsx')

# ملف ثانٍ: نفس الصفوف لكن ملاحظة الوحدة 5 فارغة (العمود موجود والخلية فاضية → امسح)
wb2 = Workbook()
ws2 = wb2.active
ws2.title = "الوحدات"
ws2.append(headers)
for i in range(1, 24):
    ws2.append(['المهبوله 1', i, 1, 100, 'شقة', 'مؤجرة', 250, ''])
wb2.save('/tmp/وحدات-مسح-ملاحظة.xlsx')
print('saved /tmp/وحدات-مسح-ملاحظة.xlsx')
