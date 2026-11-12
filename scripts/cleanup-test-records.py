#!/usr/bin/env python3
"""تنضيف سجلات الاختبار من قاعدة البيانات المحلية + تصفير عدّادات التسلسلات المخصصة للتجربة."""
import json, subprocess, sys

BASE = 'http://localhost:3000'
# تسجيل الدخول
login = subprocess.run(['curl', '-s', '-X', 'POST', f'{BASE}/api/auth/login',
                        '-H', 'Content-Type: application/json',
                        '-d', '{"username":"admin","password":"admin123"}'],
                       capture_output=True, text=True, timeout=60)
token = json.loads(login.stdout).get('token', '')
AUTH = f'Authorization: Bearer {token}'

def api(path, method='GET', body=None):
    cmd = ['curl', '-s', '-X', method, f'{BASE}{path}', '-H', AUTH]
    if body:
        cmd += ['-H', 'Content-Type: application/json', '-d', json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    try:
        return json.loads(out)
    except Exception:
        return {'_raw': out[:200]}

# 1) حذف الحركات التجريبية
txs = api('/api/transactions')
for t in txs if isinstance(txs, list) else []:
    if (t.get('category') or '').startswith('اختبار'):
        print('delete transaction', t.get('voucherNo'), '→', api(f"/api/transactions/{t['id']}", 'DELETE'))

# 2) تحقق نهائي
txs = api('/api/transactions')
print('remaining transactions:', [(t.get('voucherNo'), t.get('category')) for t in txs if isinstance(txs, list)])

# 3) تصفير عدّادات التسلسلات التي لا تشير لأي سجل حالي (تجربة فقط — الإنتاج غير متأثر)
import sqlite3
conn = sqlite3.connect('/home/z/my-project/db/custom.db')
cur = conn.cursor()
# تحقق: لا توجد أي سجلات بأرقام في التسلسلات الثلاثة التجريبية
def count(col, table):
    cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "{col}" IS NOT NULL')
    return cur.fetchone()[0]

used = {
    'payment': count('voucherNo', 'Transaction') + count('paymentNo', 'LoanPayment') + count('paymentNo', 'MaintenanceRequest') + count('paymentNo', 'SupplierPayment'),
    'receipt': count('receiptNo', 'Payment') + count('receiptNo', 'Loan'),
    'invoice': count('invoiceNo', 'Payment'),
}
cur.execute('SELECT key, current FROM DocCounter')
print('counters before:', dict(cur.fetchall()))
for key, n in used.items():
    if n == 0:
        cur.execute('UPDATE DocCounter SET current = 0 WHERE key = ?', (key,))
        print(f'reset counter {key} → 0 (no records use it)')
conn.commit()
cur.execute('SELECT key, current FROM DocCounter')
print('counters after:', dict(cur.fetchall()))
conn.close()
print('DONE')
