#!/bin/bash
# اختبار شامل لنظام الترقيم التسلسلي — يُشغَّل في جلسة واحدة (الخادم يُنشأ ويُقتل داخلها)
set -e
cd /home/z/my-project

echo "== 1) تشغيل الخادم =="
rm -f dev.log
setsid bash -c 'npm run dev > dev.log 2>&1 < /dev/null' & disown
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/setup-needed --max-time 10 || echo 000)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server ready: $code"

echo "== 2) تسجيل الدخول =="
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' --max-time 60 | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
[ -z "$TOKEN" ] && { echo "LOGIN FAILED"; tail -5 dev.log; exit 1; }
AUTH="Authorization: Bearer $TOKEN"
echo "token: ${TOKEN:0:10}..."

echo "== 3) backfill أول مرة (يجب أن يرقّم القديم) =="
curl -s -X POST http://localhost:3000/api/numbers/backfill -H "$AUTH" -H 'Content-Type: application/json' -d '{}' --max-time 120
echo

echo "== 4) backfill مرة ثانية (يجب total=0 — idempotent) =="
curl -s -X POST http://localhost:3000/api/numbers/backfill -H "$AUTH" -H 'Content-Type: application/json' -d '{}'
echo

echo "== 5) إنشاء عقد جديد → يجب رقم ع-#### =="
CONTRACT=$(curl -s -X POST http://localhost:3000/api/contracts -H "$AUTH" -H 'Content-Type: application/json' -d "{
  \"unitId\": \"$(curl -s http://localhost:3000/api/units -H "$AUTH" | python3 -c "import json,sys; us=json.load(sys.stdin); print(next(u['id'] for u in us if u['status']=='available'))")\",
  \"tenantId\": \"$(curl -s http://localhost:3000/api/tenants -H "$AUTH" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")\",
  \"startDate\": \"2026-01-01\", \"endDate\": \"2026-12-31\", \"rentAmount\": 450, \"discount\": 0, \"deposit\": 100
}" --max-time 60)
echo "$CONTRACT" | python3 -c "import json,sys; d=json.load(sys.stdin); print('contract id:', d.get('id','?')[:10], '| number:', d.get('number'))"
CID=$(echo "$CONTRACT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")

echo "== 6) تسجيل دفعة على العقد الجديد → يجب فاتورة ف-#### وسند قبض ق-#### =="
PAY=$(curl -s -X POST http://localhost:3000/api/payments -H "$AUTH" -H 'Content-Type: application/json' -d "{\"contractId\":\"$CID\",\"amount\":450,\"month\":\"2026-01\",\"status\":\"paid\",\"method\":\"cash\"}" --max-time 60)
echo "$PAY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('payment amount:', d.get('amount'), '| invoiceNo:', d.get('invoiceNo'), '| receiptNo:', d.get('receiptNo'))"

echo "== 7) حركة مالية مصروف → يجب سند ص-#### =="
TX=$(curl -s -X POST http://localhost:3000/api/transactions -H "$AUTH" -H 'Content-Type: application/json' -d '{"date":"2026-11-12","type":"expense","category":"اختبار تسلسل","amount":25,"cashAccount":"cash"}' --max-time 60)
echo "$TX" | python3 -c "import json,sys; d=json.load(sys.stdin); print('transaction:', d.get('category'), '| voucherNo:', d.get('voucherNo'))"

echo "== 8) حركة مالية إيراد → يجب سند ق-#### =="
TX2=$(curl -s -X POST http://localhost:3000/api/transactions -H "$AUTH" -H 'Content-Type: application/json' -d '{"date":"2026-11-12","type":"income","category":"اختبار إيراد","amount":75,"cashAccount":"bank"}' --max-time 60)
echo "$TX2" | python3 -c "import json,sys; d=json.load(sys.stdin); print('transaction:', d.get('category'), '| voucherNo:', d.get('voucherNo'))"

echo "== 9) تعديل نوع الحركة من إيراد إلى مصروف → يجب سند ص جديد =="
TX2ID=$(echo "$TX2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -X PUT "http://localhost:3000/api/transactions/$TX2ID" -H "$AUTH" -H 'Content-Type: application/json' -d '{"type":"expense"}' --max-time 60 | python3 -c "import json,sys; d=json.load(sys.stdin); print('after type change → voucherNo:', d.get('voucherNo'))"

echo "== 10) محاولة تمرير رقم سند مزيف في PUT الدفعة (يجب تجاهله) =="
PAYID=$(echo "$PAY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -X PUT "http://localhost:3000/api/payments/$PAYID" -H "$AUTH" -H 'Content-Type: application/json' -d '{"notes":"اختبار حماية التسلسل","receiptNo":"ق-9999"}' --max-time 60 | python3 -c "import json,sys; d=json.load(sys.stdin); print('receiptNo after spoof attempt:', d.get('receiptNo'), '| notes:', d.get('notes'))"

echo "== 11) أعداد السجلات (voucherRegister badge) =="
curl -s http://localhost:3000/api/counts -H "$AUTH" | python3 -c "import json,sys; d=json.load(sys.stdin); print('contracts:', d.get('contracts'), '| payments:', d.get('payments'), '| voucherRegister:', d.get('voucherRegister'))"

echo "== 12) تنضيف: حذف العقد التجريبي والحركات التجريبية =="
curl -s -X DELETE "http://localhost:3000/api/contracts/$CID" -H "$AUTH" > /dev/null && echo "test contract deleted"
curl -s -X DELETE "http://localhost:3000/api/transactions/$TX2ID" -H "$AUTH" > /dev/null && echo "test tx2 deleted"
TXID=$(echo "$TX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
curl -s -X DELETE "http://localhost:3000/api/transactions/$TXID" -H "$AUTH" > /dev/null && echo "test tx1 deleted"

echo "== DONE =="
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
