# ScoreBright — ระบบบันทึกคะแนน + Export เข้า SchoolBright

สถานะ:
- **Phase 1 (Export spike): เสร็จและยืนยันแล้ว** — ไฟล์จาก spike import เข้า SchoolBright จริงได้ครบ ทั้งหัวข้อ สัดส่วน คะแนนรายนักเรียน และทศนิยม
- **Phase 2 (โครงเว็บ + login + ปีการศึกษา + รายชื่อนักเรียน): เสร็จ ใช้งานกับฐานข้อมูลจริงแล้ว**
  + dashboard, navbar, บัญชีผู้ใช้ของระบบเอง (ตาราง users ใน score_app)
- **Phase 3 (จัดการวิชา + สัดส่วน + หัวข้อคะแนน): เสร็จ ทดสอบกับข้อมูลจริงแล้ว**
  สร้าง/แก้/ลบวิชา (เลือกห้องจากห้องที่มีนักเรียนจริงในปีนั้น), สัดส่วน 4 ช่วง validate รวม = 100,
  หัวข้อคะแนน 4 หมวดตาม limit ของ template (20/10/20/10), ชื่อหัวข้อซ้ำได้ (SchoolBright รองรับ),
  กันชื่อขึ้นต้นด้วย = + - @, เรียงลำดับ/แก้ไข/ลบหัวข้อพร้อมคำเตือนเมื่อมีคะแนนแล้ว
- **Phase 6 (จัดการผู้ใช้ + UX/UI): เสร็จ** — หน้า `/users` (admin เท่านั้น): เพิ่มผู้ใช้/แก้สิทธิ์/
  รีเซ็ตรหัสผ่าน/ปิดใช้งาน (กันปิดบัญชีตัวเอง + กันลบ admin คนสุดท้าย), ปรับ UI ทั้งระบบ
  (navbar ไอคอน + sticky, dashboard การ์ดสถิติ + ทางลัดกรอกคะแนน, login ใหม่, grid sticky header + zebra)
  + หน้าสรุปคะแนน/เกรด `/subjects/[id]/summary` — คะแนนถ่วงน้ำหนักรายช่วง รวม 100 → เกรด 8 ระดับ
    (เกณฑ์มาตรฐาน ศธ.), สถิติห้อง (เฉลี่ย/GPA/ผ่าน-ตก/การกระจายเกรด), เลือกดูทุกห้อง/ทีละห้อง
- **Phase 7 (deploy): ยังไม่เริ่ม** — ดูหมายเหตุท้ายไฟล์เรื่อง Node บน Windows Server 2012 R2
- **Phase 5 (Export engine): โค้ดเสร็จ — ใช้ logic ที่พิสูจน์กับ SchoolBright จริงจาก Phase 1**
  หน้า `/subjects/[id]/export` — validate ก่อน export (สัดส่วนครบ 100 / มีหัวข้อทุกช่วงที่สัดส่วน > 0 /
  ห้องไม่เกิน 60 คน = block, นักเรียนคะแนนว่าง = เตือน), ดาวน์โหลดรายห้อง (.xlsx) หรือทุกห้อง (.zip),
  ชื่อไฟล์ `รหัสวิชา_ชั้น-ห้อง_เทอมX-ปีพ.ศ.xlsx`, unit test เทียบ 32 เซลล์สำคัญ (`npm run test:export`)
- **Phase 4 (grid กรอกคะแนน): โค้ดเสร็จ รอทดสอบ**
  หน้า `/subjects/[id]/scores` — แท็บ 7 หมวด (4 หมวดคะแนน + คุณลักษณะฯ/อ่านคิดฯ/สมรรถนะ),
  เลือกทุกห้อง/ทีละห้อง, คีย์บอร์ดแบบ Excel (Enter/ลูกศร/Tab), **paste จาก Excel หลายแถวหลายคอลัมน์**,
  คะแนนเกินเต็ม/ผิดรูปแบบขึ้นแดงและไม่บันทึก, auto-save (debounce 1.2s) + ปุ่มบันทึกเดี๋ยวนี้ +
  เตือนก่อนปิดหน้า, ใส่เต็ม 3 ระดับ (คอลัมน์/ทั้งแท็บเฉพาะช่องว่าง/ทับทั้งหมด) + เลิกทำ,
  คอลัมน์รวมสด (SUM สำหรับคะแนน / ฐานนิยมสำหรับคุณลักษณะฯ ตามสูตร template),
  บันทึกแบบ bulk upsert รองรับวางทีละหลายพันช่อง

## การติดตั้ง (Phase 2)

### 1. สร้าง database และ MySQL user

รันใน phpMyAdmin/HeidiSQL ด้วยบัญชี root ของ MariaDB (XAMPP):

```sql
CREATE DATABASE IF NOT EXISTS score_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'score_app'@'localhost' IDENTIFIED BY 'รหัสผ่านที่ปลอดภัย';

-- สิทธิ์เต็มเฉพาะ score_app
GRANT ALL PRIVILEGES ON score_app.* TO 'score_app'@'localhost';

-- school_app อ่านได้อย่างเดียว — ป้องกันแอปนี้แตะข้อมูลระบบหลักโดยเด็ดขาด
GRANT SELECT ON school_app.* TO 'score_app'@'localhost';

FLUSH PRIVILEGES;
```

### 2. ตั้งค่า .env

```bash
copy .env.example .env
```

แก้ `DATABASE_URL` ให้ตรงรหัสผ่านที่ตั้งไว้ และสร้าง `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. สร้างตารางและรัน

```bash
npm install
npx prisma db push     # สร้างตารางใน score_app ตาม prisma/schema.prisma
npm run seed:admin     # สร้างบัญชี admin/admin1234 (เปลี่ยนรหัสก่อนใช้จริง)
npm run dev            # http://localhost:3001
npx tsx scripts/check-setup.ts   # ตรวจความพร้อมทั้งระบบเมื่อสงสัยว่าต่อ DB ได้ไหม
```

### สิ่งที่ใช้ได้แล้วใน Phase 2

- **บัญชีผู้ใช้เป็นของ ScoreBright เอง** (ตาราง `users` ใน score_app) — ไม่แตะ `school_app.users`
  ข้อมูลที่ดึงจาก school_app มีแค่นักเรียนกับปีการศึกษา (อ่านอย่างเดียว)
  สร้างบัญชีเพิ่ม: `npx tsx scripts/seed-admin.ts ชื่อผู้ใช้ รหัสผ่าน`
- Login/Logout (JWT cookie 12 ชม., กันทุกหน้าผ่าน proxy)
- หน้า **ตั้งค่าปีการศึกษา + ภาคเรียน** (`/setup`) — ค่าเริ่มต้นมาจากปีที่ `is_active=1`,
  เปลี่ยนได้เฉพาะ admin, เปลี่ยนแล้วข้อมูลปี/เทอมเดิมไม่หาย, badge ปี/เทอมแสดงบน navbar ทุกหน้า
- หน้า **รายชื่อนักเรียน** (`/students`) — read-only จาก `school_app.students` ของปีที่ตั้งไว้,
  กรองชั้น/ห้อง + ค้นหาชื่อ/รหัส, สรุปจำนวนต่อห้อง, ตรวจสุขภาพข้อมูลอัตโนมัติ
  (รหัสซ้ำ / เลขที่ซ้ำในห้อง / ห้องเกิน 60 คน)

## Phase 1: Export spike (ยืนยันกับระบบจริงแล้ว)

```bash
npm run spike-export       # → out/ว22101_ม.2-1_เทอม1-2569.xlsx + self-check 51 ข้อ
npm run inspect-template   # dump โครงสร้าง template → inspect-output.txt
```

### หลักการ export ที่พิสูจน์แล้ว (ใช้ต่อใน Phase 5)

- เคลียร์ข้อมูล demo ใน template ออกทั้งหมด (นักเรียน 123/456/A123, หัวข้อ "ตัวอย่าง", คะแนนเต็ม 10)
- **สูตรทุกตัวแทนด้วยค่า literal ที่คำนวณใน TypeScript** (ExcelJS ไม่ recalculate)
- ค่าใน sheet ลับ `สำหรับdev1`/`สำหรับdev2` อ่านสูตรจริงจาก template แล้ว resolve
  (`IF(ref=0,"",ref)`, `IF(ref="","",ref)`, `SUM(a+b)`) — สูตรรูปแบบใหม่ที่ไม่รู้จักจะ throw ทันที
- คอลัมน์ "รวม" sheet คะแนน = ว่างถ้าว่างหมด ไม่งั้น SUM / sheet คุณลักษณะ-อ่านคิด-สมรรถนะ =
  ฐานนิยมตัวมากสุด (`MAX(MODE.MULT)`), ไม่มีค่าซ้ำ → ว่าง
- **รหัสนักเรียน (`stdSID`) ต้องมีจริงใน SchoolBright** ไม่งั้นคะแนนทั้งไฟล์ถูกปัดตก (Bad Request)
- ทศนิยมใช้ได้ / placeholder header ("2".."20") ของช่องที่ไม่ใช้คงไว้ได้
- จำกัด 60 คน/ไฟล์, 1 ไฟล์ = 1 วิชา × 1 ห้อง

## โครงสร้าง

```
templates/   template ของ SchoolBright — ห้ามแก้ไฟล์นี้ ทุกการ export ทำงานบนสำเนาในหน่วยความจำ
scripts/     inspect-template.ts, spike-export.ts
prisma/      schema ของ score_app (AppSetting, Subject, ScoreConfig, ScoreItem, Score, TraitScore)
src/lib/     prisma.ts, school-app.ts (raw SELECT ข้าม db), auth.ts, auth-token.ts, app-setting.ts
src/app/     login, (app)/setup, (app)/students, (app)/subjects (Phase 3)
```

## Stack

Next.js 16 (App Router) + TypeScript · Prisma 6 + MySQL/MariaDB · Tailwind 4 + shadcn/ui ·
ExcelJS · JWT (jose) + bcryptjs

แผนงานทั้งหมด: ดู `prompt_schoolbright_score_app.md`
(Phase 3 = จัดการวิชา/สัดส่วน/หัวข้อ, Phase 4 = grid กรอกคะแนน + paste จาก Excel,
Phase 5 = export engine + zip รายวิชา, Phase 6 = deploy)

> หมายเหตุ deploy: Windows Server 2012 R2 อาจรัน Node รุ่นที่ Next.js 16 ต้องการ (Node 20+) ไม่ได้
> ต้องเช็คก่อนใน Phase 6 — ทางเลือกคือรันแอปบนเครื่องอื่นในเครือข่ายแล้วชี้ DATABASE_URL มาที่ server เดิม
