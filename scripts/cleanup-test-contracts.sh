#!/bin/bash
# تنظيف عقود الاختبار قبل إعادة الاختبار
BASE=http://localhost:3000
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"

IDS=$(curl -s $BASE/api/contracts -H "$AUTH" | python3 -c "import sys,json;print(' '.join(c['id'] for c in json.load(sys.stdin)))")
n=0
for id in $IDS; do
  curl -s -X DELETE "$BASE/api/contracts/$id" -H "$AUTH" > /dev/null && n=$((n+1))
done
echo "deleted contracts: $n"
curl -s $BASE/api/contracts -H "$AUTH" | python3 -c "import sys,json;print('contracts left:',len(json.load(sys.stdin)))"
curl -s $BASE/api/units -H "$AUTH" | python3 -c "import sys,json;d=json.load(sys.stdin);print('rented units:',sum(1 for u in d if u['status']=='rented'))"
