#!/bin/bash
# دورة تحقق مركزة: دفعة جديدة → فاتورة ف + سند ق + حماية التسلسل + سجل السندات
cd /home/z/my-project
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' --max-time 30 | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
AUTH="Authorization: Bearer $TOKEN"

echo "== 1) تنضيف الحركات التجريبية السابقة =="
curl -s http://localhost:3000/api/transactions -H "$AUTH" | python3 -c "
import json,sys,subprocess
ts=json.load(sys.stdin)
for t in ts:
    if t.get('category','').startswith('اختبار'):
        print('delete', t['voucherNo'], t['id'][:10])
        subprocess.run(['curl','-s','-X','DELETE',f\"http://localhost:3000/api/transactions/{t['id']}\",'-H','Authorization: Bearer $AUTH'],capture_output=True)
" AUTH="$AUTH"

echo "== 2) عقد جديد للتجربة =="
UNIT=$(curl -s http://localhost:3000/api/units -H "$AUTH" | python3 -c "import json,sys; us=json.load(sys.stdin); print(next(u['id'] for u in us if u['status']=='available'))")
TENANT=$(curl -s http://localhost:3000/api/tenants -H "$AUTH" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
CONTRACT=$(curl -s -X POST http://localhost:3000/api/contracts -H "$AUTH" -H 'Content-Type: application/json' -d "{\"unitId\":\"$UNIT\",\"tenantId\":\"$TENANT\",\"startDate\":\"2026-01-01\",\"endDate\":\"2026-12-31\",\"rentAmount\":450,\"discount\":0,\"deposit\":100}" --max-time 60)
echo "$CONTRACT" | python3 -c "import json,sys; d=json.load(sys.stdin); print('contract number:', d.get('number'))"
CID=$(echo "$CONTRACT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")

echo "== 3) دفعة جديدة → فاتورة ف-#### وسند قبض ق-#### =="
PAY=$(curl -s -X POST http://localhost:3000/api/payments -H "$AUTH" -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"amount\":450,\"month\":\"2026-02\",\"status\":\"paid\",\"method\":\"cash\"}" --max-time 60)
echo "$PAY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('invoiceNo:', d.get('invoiceNo'), '| receiptNo:', d.get('receiptNo'), '| amount:', d.get('amount'))"
PAYID=$(echo "$PAY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")

echo "== 4) محاولة تزوير رقم السند عبر PUT (يجب أن تُتجاهل) =="
curl -s -X PUT "http://localhost:3000/api/payments/$PAYID" -H "$AUTH" -H 'Content-Type: application/json' -d '{"notes":"spoof test","receiptNo":"ق-9999"}' --max-time 60 | python3 -c "import json,sys; d=json.load(sys.stdin); print('receiptNo after spoof:', d.get('receiptNo'), '| notes:', d.get('notes'))"

echo "== 5) دفعة جزئية → تسلسل مستقل للقبض =="
PAY2=$(curl -s -X POST http://localhost:3000/api/payments -H "$AUTH" -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"amount\":200,\"month\":\"2026-03\",\"status\":\"paid\",\"method\":\"cash\"}" --max-time 60)
echo "$PAY2" | python3 -c "import json,sys; d=json.load(sys.stdin); print('partial → invoiceNo:', d.get('invoiceNo'), '| receiptNo:', d.get('receiptNo'), '| status:', d.get('status'))"

echo "== 6) دفعة مورد → سند ص-#### =="
SUP=$(curl -s http://localhost:3000/api/suppliers -H "$AUTH" | python3 -c "import json,sys; ss=json.load(sys.stdin); print(ss[0]['id'] if ss else '')")
if [ -n "$SUP" ]; then
  SP=$(curl -s -X POST http://localhost:3000/api/supplier-payments -H "$AUTH" -H 'Content-Type: application/json' -d "{\"supplierId\":\"$SUP\",\"date\":\"2026-11-12\",\"amount\":150,\"description\":\"اختبار سند مورد\"}" --max-time 60)
  echo "$SP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('supplier paymentNo:', d.get('paymentNo'))"
  SPID=$(echo "$SP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
else
  echo "لا يوجد موردين — تخطي"; SPID=""
fi

echo "== 7) أعداد شارة سجل السندات =="
curl -s http://localhost:3000/api/counts -H "$AUTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print('voucherRegister:', d.get('voucherRegister'))"

echo "== 8) تنضيف =="
curl -s -X DELETE "http://localhost:3000/api/contracts/$CID" -H "$AUTH" > /dev/null && echo "contract+payments deleted (cascade)"
[ -n "$SPID" ] && curl -s -X DELETE "http://localhost:3000/api/supplier-payments/$SPID" -H "$AUTH" > /dev/null && echo "supplier payment deleted"
echo "== DONE =="
