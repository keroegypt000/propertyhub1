#!/usr/bin/env python3
# إنشاء ملف عقود معدل: نفس صفوف العميل + تعديل خصم الوحدة 1 + صفان جديدان (22، 23)
import shutil
from openpyxl import load_workbook

SRC = "/home/z/my-project/upload/العقود-2026-11-12 (1).xlsx"
DST = "/tmp/العقود-معدل.xlsx"
shutil.copy(SRC, DST)
wb = load_workbook(DST)
ws = wb[wb.sheetnames[0]]
# الصف الأول رؤوس. البيانات من الصف الثاني. صف الوحدة 1 هو الصف 2 (خلية B2 = رقم الوحدة).
assert str(ws.cell(row=2, column=2).value) == "1", ws.cell(row=2, column=2).value
# تعديل الخصم الشهري للوحدة 1: 40 → 45 (العمود 7 = الخصم الشهري)
assert ws.cell(row=2, column=7).value == 40, ws.cell(row=2, column=7).value
ws.cell(row=2, column=7).value = 45
# إضافة صفين جديدين: وحدة 22 و23
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
print("الرؤوس:", headers)
rows = [
    ["المهبوله 1", 22, "مستأجر إضافي أول", "2026-11-01", "2027-11-01", 300, 0, 0, 10, "نشط", "*", "*"],
    ["المهبوله 1", 23, "مستأجر إضافي ثاني", "2026-12-01", "2027-12-01", 320, 20, 0, 15, "نشط", "*", "*"],
]
r = ws.max_row + 1
for row in rows:
    for ci, v in enumerate(row, start=1):
        ws.cell(row=r, column=ci, value=v)
    r += 1
wb.save(DST)
print("saved:", DST, "rows:", ws.max_row - 1)
