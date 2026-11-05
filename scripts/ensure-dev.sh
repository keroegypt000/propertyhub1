#!/bin/bash
# يضمن أن سيرفر التطوير يعمل على المنفذ 3000 بشكل صحيح:
# 1) عميل Prisma متولد من سكيما SQLite (schema.dev.prisma) — البيئة تعيد توليده من سكيما PostgreSQL عند كل إعادة بناء
# 2) ملف قاعدة البيانات db/custom.db موجود
# 3) السيرفر يعمل — يشغّله إذا كان متوقفًا
cd /home/z/my-project

# --- إصلاح عميل Prisma إذا كان من سكيما الخطأ (postgresql) ---
if [ -f node_modules/.prisma/client/schema.prisma ] && grep -q postgresql node_modules/.prisma/client/schema.prisma; then
  echo "prisma client: wrong schema (postgres) → regenerating from dev schema..."
  npx prisma generate --schema prisma/schema.dev.prisma > /dev/null 2>&1
  # إعادة تشغيل السيرفر إن كان شغالًا بعميل قديم
  pkill -f "next dev" 2>/dev/null
  sleep 2
fi

# --- إصلاح قاعدة البيانات إذا كانت مفقودة ---
if [ ! -f db/custom.db ]; then
  echo "db: custom.db missing → creating..."
  mkdir -p db
  npx prisma db push --schema prisma/schema.dev.prisma --skip-generate > /dev/null 2>&1
  npx tsx scripts/seed-admin.ts 2>&1 | tail -1
fi

# --- مزامنة سكيما القاعدة دائمًا (السنابشوت قد يعيد ملفًا قديمًا بأعمدة ناقصة) ---
npx prisma db push --schema prisma/schema.dev.prisma --skip-generate > /dev/null 2>&1

# --- تشغيل السيرفر ---
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 2 | grep -q "200\|307\|302"; then
  echo "server: already up"
  exit 0
fi
nohup npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 3)
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "302" ]]; then
    echo "server: started ($code) after ${i} tries"
    exit 0
  fi
  sleep 2
done
echo "server: FAILED to start"
tail -20 /tmp/dev.log
exit 1
