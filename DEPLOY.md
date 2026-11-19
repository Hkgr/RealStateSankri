# نشر المشروع على السيرفر (Plesk)

التطبيق واحد: تطبيق Node يخدم الـ API ولوحة المعلومات معًا، ويقرأ من قاعدة MySQL/MariaDB. المطلوب في Plesk: قاعدة بيانات + تطبيق Node.js.

## 0) قبل البدء

- في Plesk يجب أن يكون **امتداد Node.js** مثبّتًا على اشتراكك (إن لم يظهر خيار Node.js في صفحة النطاق فاطلب من الاستضافة تفعيله). الإصدار المطلوب **22 أو 20.12 على الأقل**.
- **لا توجد كلمة مرور على اللوحة.** البيانات أسماء ملكيات ونزاعات عقارية، فلا تنشرها دون حماية (الخطوة 6).

## 1) إنشاء قاعدة البيانات

Plesk ← **Websites & Domains** ← **Databases** ← **Add Database**: أنشئ قاعدة ومستخدمًا بكلمة مرور قوية. سجّل الأسماء **كما يعرضها Plesk** (غالبًا بسابقة مثل `user_realestate`).

## 2) نقل البيانات (الـ migration)

لا حاجة لأداة migration: المخطط (`server/sql/schema.sql`) والبيانات مصدّران في ملف واحد جاهز: `deploy/realestate_insights.sql` (245 KB، يحوي الجداول السبعة وبياناتها، ويحذف الجدول ويعيد إنشاءه إن وُجد). جُرّب استيراده على MariaDB وMySQL 8 فطابقت الأعداد (166 عقارًا، 1127 إشارة).

الطريقة: Databases ← قاعدتك ← **Import Dump** (أو **phpMyAdmin** ← Import) ← اختر الملف ← استورد. تأكد أن الترميز utf8mb4.

بديل بالـ SSH: `mysql -u USER -p DBNAME < realestate_insights.sql`

## 3) رفع الملفات

ارفعها **خارج** مجلد الموقع العام (`httpdocs`)، مثلًا في `/realestate-app/`، بهذا الشكل بالضبط (المجلدان متجاوران لأن الخادم يبحث عن `../frontend/dist`):

```
realestate-app/
├─ server/
│  ├─ app.cjs
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ src/
│  └─ sql/
└─ frontend/
   └─ dist/        ← ناتج npm run build
```

لا ترفع: `node_modules` (يُثبَّت على السيرفر) ولا `.env` ولا ملف الإكسل ولا `test/`.

قبل الرفع، ابنِ الواجهة على جهازك: `npm run build` (من `D:\RealEstate`).

## 4) إعداد تطبيق Node.js

النطاق ← **Node.js**:

| الحقل | القيمة |
|---|---|
| Node.js version | 22 (أو الأحدث المتاح ≥ 20.12) |
| Application mode | production |
| Application root | `/realestate-app/server` |
| Application startup file | `app.cjs` |
| Document root | اتركه الافتراضي (`httpdocs`) فارغًا |

**Custom environment variables** (أسماء قاعدتك كما أنشأها Plesk):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=<مستخدم القاعدة>
DB_PASSWORD=<كلمة المرور>
DB_NAME=<اسم القاعدة>
```

لا تضبط `PORT` ولا `HOST`؛ Plesk (Passenger) يحدّد العنوان بنفسه.

ثم اضغط **NPM install** (يثبّت express وmysql2)، ثم **Restart App**.

## 5) التحقق

- `https://نطاقك/api/v1/health` يجب أن يعيد `{"data":{"status":"ok"}}`.
- ثم افتح `https://نطاقك/` واختبر: العدّاد يظهر 166 عقارًا، وتبويب «جودة البيانات» يعمل.

إن ظهر خطأ: صفحة Node.js في Plesk فيها **Logs**. أشيع الأسباب: متغيرات القاعدة خاطئة («تعذّر الاتصال بقاعدة البيانات»)، أو لم تُنفَّذ NPM install، أو مجلد `frontend/dist` ليس بجانب `server`.

## 6) الحماية (مهم)

- فعّل **HTTPS**: Let's Encrypt من صفحة النطاق.
- فعّل **Password-Protected Directories** على جذر الموقع (`/`) بمستخدم وكلمة مرور، أو قيّد الوصول بعناوين IP. وإلا فكل من يعرف الرابط يرى أسماء الملاك والإشارات.
- لا تضع ملف الإكسل أو الـ dump داخل `httpdocs`.

## 6-ب) الوثائق (اختياري)

1. على جهازك: `npm run docs:ingest -- --source "<مجلد المنطقة>"` (من `server`)، فتُنسخ الملفات الفريدة إلى `storage/documents/blobs`.
2. ارفع المجلد `storage/documents` كله إلى السيرفر **خارج** `httpdocs` (SFTP أو rsync؛ ماير وحدها 0.26 GB)، مثل `/realestate-app/storage/documents`.
3. أضف متغيّرات: `DOCS_DIR=/realestate-app/storage/documents` و`BASIC_AUTH_USER` و`BASIC_AUTH_PASSWORD` (بلا حماية الدخول لا تُعرض الوثائق أبدًا).
4. صدّر dump جديدًا يتضمن جدولَي `documents` و`parcel_documents` واستورده كما في الخطوة 2، ثم **Restart App**.

بعد أي تغيير في `schema.sql` صدّر الـ dump من جديد قبل الرفع، وإلا تنقص جداول على السيرفر (يبقى الموقع شغالًا وتظهر البطاقة «لم تُفهرس وثائق بعد»).

## 7) تحديث لاحق

- **بيانات جديدة في الإكسل:** على جهازك `npm run db:import`، ثم صدّر dump جديدًا:
  ```powershell
  C:\wamp64\bin\mariadb\mariadb11.4.9\bin\mariadb-dump.exe -uroot --default-character-set=utf8mb4 --single-transaction --no-tablespaces --skip-add-locks --skip-comments --skip-triggers --no-create-db realestate_insights > deploy\realestate_insights.sql
  ```
  احذف أول سطر إن كان `/*M!999999\- enable the sandbox mode */`، ثم استورده في Plesk كما في الخطوة 2.
- **تعديل في الكود:** `npm run build`، ارفع `frontend/dist` وما تغيّر من `server/`، ثم **Restart App**.
