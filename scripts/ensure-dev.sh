#!/bin/bash
# يضمن أن سيرفر التطوير يعمل على المنفذ 3000 — يشغّله إذا كان متوقفًا
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 2 | grep -q "200\|307\|302"; then
  echo "server: already up"
  exit 0
fi
cd /home/z/my-project
nohup npm run dev > /tmp/dev.log 2>&1 &
# انتظر حتى يستجيب السيرفر (حتى 90 ثانية لأول ترجمة)
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
