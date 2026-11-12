#!/bin/bash
# تجهيز بيانات اختبار سيناريو الاستيراد الذكي للعقود — مطابق لملف العميل
set -e
BASE=http://localhost:3000
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"
CT='Content-Type: application/json'

# عمارة المهبوله 1
BID=$(curl -s -X POST $BASE/api/buildings -H "$AUTH" -H "$CT" -d '{"name":"المهبوله 1","code":"MH1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "BID=$BID"

# 23 وحدة
for i in $(seq 1 23); do
  curl -s -X POST $BASE/api/units -H "$AUTH" -H "$CT" -d "{\"buildingId\":\"$BID\",\"number\":\"$i\",\"rentAmount\":250,\"status\":\"available\"}" > /dev/null
done
echo "units done"

# 21 مستأجرًا من ملف العميل + 2 إضافيين لاختبار الصفوف الجديدة
TENANTS=("دينوشا ثيروحانا رناتباني" "محمد علي سهيب علي" "صالح جان طالب جان" "راجو سونار" "عطا الله قاسم السليمان" "بارثي لثاسوندر راجون" "ظفر علي طور لعلي" "جيبين جو هنروسي جو هنروسي" "رانج بهادور سوندار" "محمود قاسم جزانري" "بديعه ابليسنير" "زينب احمد محمد" "حسام الدين عطيه ابو بكر" "وليد محمد حامد النجار" "جونسون بوتانانيكال ايمانويل" "جمناس تشاميا شروفيل" "شركة حصه للمجوهرات الذهبيه" "ممتاج او ثو ما ليبي" "جيجو جاكوب كوريان جاكوب" "مانجادو دو كارو ناكاران" "عبد العزيز تانابوث محمد" "مستأجر إضافي أول" "مستأجر إضافي ثاني")
for name in "${TENANTS[@]}"; do
  curl -s -X POST $BASE/api/tenants -H "$AUTH" -H "$CT" -d "{\"name\":\"$name\"}" > /dev/null
done
echo "tenants done"

# تحقق
curl -s $BASE/api/buildings -H "$AUTH" | python3 -c "import sys,json;d=json.load(sys.stdin);print('buildings:',len(d))"
curl -s $BASE/api/units -H "$AUTH" | python3 -c "import sys,json;d=json.load(sys.stdin);print('units:',len(d))"
curl -s $BASE/api/tenants -H "$AUTH" | python3 -c "import sys,json;d=json.load(sys.stdin);print('tenants:',len(d))"
