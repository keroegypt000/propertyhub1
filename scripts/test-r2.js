// اختبار الاتصال بـ Cloudflare R2 — يقرأ كل القيم من متغيرات البيئة (بدون أي أسرار في الملف)
const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET || !BUCKET) {
  console.error('FAILED: متغيرات البيئة ناقصة');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET },
});

(async () => {
  try {
    // 1) قراءة قائمة الكائنات
    const list = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 5 }));
    console.log(`SUCCESS: الوصول للبكت "${BUCKET}" تم — عدد الكائنات الحالي: ${list.KeyCount ?? 0}`);
    (list.Contents || []).forEach(o => console.log('  -', o.Key, `(${o.Size} bytes)`));

    // 2) اختبار كتابة ملف صغير ثم حذفه (إثبات صلاحية Write)
    const testKey = '_connection_test/probe.txt';
    await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: testKey, Body: 'propertyhub-test', ContentType: 'text/plain' }));
    console.log('SUCCESS: الكتابة على البكت تعمل (PUT)');

    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: testKey }));
    console.log('SUCCESS: الحذف يعمل (DELETE) — الملف التجريبي اتشال');

    console.log('ALL_OK: المفاتيح جاهزة 100% — كمّل خطوات Vercel');
  } catch (e) {
    console.error('FAILED:', e.name, '-', e.message);
    process.exit(1);
  }
})();
