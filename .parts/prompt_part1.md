# 🏢 البرومت الكامل — إعادة بناء نظام PropertyHub بالكامل

> **إزاي تستخدم الملف ده؟** انسخ المحتوى كله والصقه في أي أداة ذكاء اصطناعي (Claude / ChatGPT / Z.ai...) كأول رسالة، واطلب منه يبني المشروع خطوة بخطوة بنفس الترتيب الموجود في القسم الأخير. البرومت ده يوصف النظام 100% كما بُني فعليًا: كل جدول، كل صفحة، كل قاعدة عمل، كل ميزة.

---

## 1) الهوية والهدف

ابنِ لي نظامًا متكاملًا لإدارة الأملاك والعقارات باسم **PropertyHub**:

- **السوق المستهدف:** دولة الكويت (عملة **دينار كويتي KWD** بـ 3 خانات عشرية — 1000 فلس = 1 دينار — الرمز المعروض `د.ك`).
- **اللغة والاتجاه:** واجهة **عربية بالكامل RTL** (`<html lang="ar" dir="rtl">`)، كل التسميات والحالات والرسائل بالعربية، مع أرقام لاتينية.
- **المستخدمون:** مالك مكتب إدارة عقارات صغير + موظفوه (مدير، مدير فرعي، محاسب، محصّل، مشاهد).
- **الفلسفة:** محاسبة قيد مزدوج حقيقية تولّد القيود **تلقائيًا** من العمليات التشغيلية، مع سندات قبض/صرف قابلة للطباعة، وحماية كاملة بالأدوار والصلاحيات وسجل تدقيق ونقاط استعادة.

## 2) التقنيات (Tech Stack)

| الطبقة | الاختيار |
|---|---|
| Framework | **Next.js 16 (App Router)** + **React 19** + TypeScript |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (كل مكونات Radix: Dialog, Select, Table, Badge, Card, Tabs...) |
| Database | **PostgreSQL** عبر **Prisma ORM** (Prisma Postgres المستضاف على Vercel) |
| Icons / Toasts | **lucide-react** + **sonner** |
| Auth | مخصص بدون مكتبات: scrypt + جلسات في قاعدة البيانات (Cookie HttpOnly + Bearer) |
| التخزين | **Cloudflare R2** (متوافق S3 عبر @aws-sdk/client-s3) مع وضع احتياطي داخل قاعدة البيانات |
| النشر | **Vercel** (نشر تلقائي بعد كل push على main) |

## 3) قاعدة البيانات — Prisma Schema كامل (16 جدولًا)

انسخ هذا الـ schema حرفيًا في `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
}

// === المستخدمون والجلسات ===
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  name         String
  passwordHash String
  salt         String
  role         String    @default("viewer") // admin, manager, accountant, collector, viewer
  permissions  String?   // JSON: صلاحيات دقيقة لكل كيان
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions      Session[]
  auditLogs     AuditLog[]
  uploads       FileUpload[]
  restorePoints RestorePoint[]
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// === إدارة الأملاك ===
model Building {
  id          String   @id @default(cuid())
  code        String   @unique  // كود العمارة
  name        String
  address     String?
  city        String?
  floors      Int?
  unitsCount  Int?
  value       Float?   @default(0) // القيمة الدفترية
  license     String?  // رقم الترخيص / السجل العقاري
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  units       Unit[]
  transactions Transaction[]
}

model Unit {
  id          String   @id @default(cuid())
  buildingId  String
  number      String
  floor       Int?
  area        Float?
  type        String?  // apartment, office, shop, warehouse
  status      String   @default("available") // available, rented, maintenance, reserved
  rentAmount  Float?   // الإيجار الافتراضي
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  building    Building  @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  contracts   Contract[]
  maintenanceRequests MaintenanceRequest[]
}

model Tenant {
  id              String   @id @default(cuid())
  name            String
  phone           String?
  email           String?
  idNumber        String?  // الرقم القومي / المدني
  idType          String?  // national, passport, commercial
  address         String?
  emergencyContact String?
  guarantor       String?  // اسم الضامن
  guarantorPhone  String?  // هاتف الضامن
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  contracts     Contract[]
  uploads       FileUpload[]
}

model Contract {
  id           String   @id @default(cuid())
  unitId       String
  tenantId     String
  startDate    DateTime
  endDate      DateTime
  rentAmount   Float
  deposit      Float?   @default(0) // مبلغ التأمين
  paymentDay   Int?     // يوم الدفع من الشهر
  status       String   @default("active") // active, expired, terminated, renewed, vacated
  vacatedDate  String?  // تاريخ الإخلاء
  refund       Float?   // المبلغ المردود من التأمين
  terms        String?
  notes        String?
  rentHistory  String?  // JSON: [{from, rent}]
  renewHistory String?  // JSON: [{on, oldEnd, newEnd, rent}]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  unit         Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  payments     Payment[]
  attachments  FileUpload[]
}

model Payment {
  id          String   @id @default(cuid())
  contractId  String
  amount      Float
  dueDate     DateTime
  paidDate    DateTime?
  month       String?  // الشهر الذي يخصه الدفع (YYYY-MM)
  status      String   @default("pending") // pending, paid, partial, overdue, cancelled
  method      String?  // cash, transfer, check, card
  reference   String?  // رقم السند / الشيك
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  contract    Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
}

// === الحركات المالية (إيراد/مصروف عام) ===
model Transaction {
  id          String   @id @default(cuid())
  date        String   // YYYY-MM-DD
  buildingId  String?
  type        String   // income, expense
  category    String   // البيان
  amount      Float
  account     String?  // رقم الحساب من شجرة الحسابات
  cashAccount String?  // الدفع من / الاستلام في (cash | bank)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  building    Building? @relation(fields: [buildingId], references: [id], onDelete: SetNull)
}

// === القروض ===
model Loan {
  id          String   @id @default(cuid())
  name        String   // اسم القرض / الجهة
  buildingId  String?  // العمارة (اختياري)
  principal   Float    // مبلغ القرض
  date        String   // تاريخ الحصول
  rate        Float    @default(0) // الفائدة السنوية %
  months      Int      @default(0) // المدة بالأشهر
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  payments    LoanPayment[]
}

model LoanPayment {
  id          String   @id @default(cuid())
  loanId      String
  date        String   // تاريخ السداد
  principal   Float    // الأصل المسدد
  interest    Float    @default(0) // الفائدة المسددة
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  loan        Loan     @relation(fields: [loanId], references: [id], onDelete: Cascade)
}

// === شجرة الحسابات ===
model Account {
  id       String  @id @default(cuid())
  code     String  @unique // رقم الحساب
  name     String
  type     String  // asset, liability, equity, revenue, expense
  kind     String  // post (فرعي يُسجل عليه) | group (رئيسي/تجميعي)
  parent   String? // معرّف الحساب الأب
