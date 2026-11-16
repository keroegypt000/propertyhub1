#!/bin/bash
# يضمن أن سيرفر التطوير على المنفذ 3000 شغال — يشغله إذا كان متوقفًا (استدعاء سريع في بداية كل دفعة أوامر)
cd /home/z/my-project
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 3)
if [[ "$code" == "200" || "$code" == "307" || "$code" == "302" ]]; then
  echo "server: up ($code)"
  exit 0
fi
pkill -f "next dev" 2>/dev/null; sleep 1
setsid nohup npm run dev > /tmp/dev.log 2>&1 < /dev/null &
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 3)
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "302" ]]; then
    echo "server: started ($code) after $i"
    exit 0
  fi
  sleep 2
done
echo "server: FAILED"; tail -15 /tmp/dev.log; exit 1
