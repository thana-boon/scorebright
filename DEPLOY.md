# คู่มือ Deploy ScoreBright บน Windows Server (XAMPP)

เป้าหมาย: เข้าผ่าน **http://192.168.200.9/scorebright** โดยแอป Next.js รันที่ port 3001
และให้ Apache ของ XAMPP ทำ reverse proxy ส่ง `/scorebright` ไปที่แอป

สภาพแวดล้อมที่ใช้ได้แล้ว: Windows Server 2012 R2 · Node 18.18.1 x64 · MariaDB (XAMPP) ที่มี `school_app`

---

## 1. เตรียมฐานข้อมูลบน server

แอปนี้ทำงานบน MariaDB ตัวเดียวกับ `school_app` รันใน phpMyAdmin (บัญชี root):

```sql
CREATE DATABASE IF NOT EXISTS score_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'score_app'@'localhost' IDENTIFIED BY 'ตั้งรหัสผ่านที่ปลอดภัย';
GRANT ALL PRIVILEGES ON score_app.* TO 'score_app'@'localhost';
GRANT SELECT ON school_app.* TO 'score_app'@'localhost';
FLUSH PRIVILEGES;
```

> แอปรันบนเครื่องเดียวกับ MariaDB จึงใช้ `localhost`/`127.0.0.1` ได้ ไม่ต้องเปิด MySQL ออกเครือข่าย

---

## 2. วางโค้ดและ build บน server

```powershell
# คัดลอกโปรเจกต์ไปไว้บน server เช่น C:\apps\scorebright (git clone หรือ copy ทั้งโฟลเดอร์ ยกเว้น node_modules/.next/.env)
cd C:\apps\scorebright

npm ci                      # ติดตั้ง dependency ตรงตาม package-lock
copy .env.example .env      # แล้วแก้ค่าตามข้อ 3
npx prisma generate
npx prisma db push          # สร้างตารางใน score_app
npm run build               # build โดยมี NEXT_PUBLIC_BASE_PATH=/scorebright (อยู่ใน .env แล้ว)
npm run seed:admin          # สร้างบัญชี admin/admin1234 (เปลี่ยนรหัสทันทีหลัง login)
```

---

## 3. ตั้งค่า .env บน server

```env
DATABASE_URL="mysql://score_app:รหัสที่ตั้งไว้@127.0.0.1:3306/score_app"
AUTH_SECRET="<สุ่มด้วย: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
NEXT_PUBLIC_BASE_PATH=/scorebright
COOKIE_SECURE=false
```

> - `NEXT_PUBLIC_BASE_PATH` ต้องตั้ง **ก่อน** `npm run build` (ค่าถูกฝังตอน build)
> - `COOKIE_SECURE=false` เพราะเข้าผ่าน HTTP — ถ้าวันหลังมี HTTPS ค่อยเปลี่ยนเป็น true

---

## 4. รันแอปด้วย pm2 (ใช้ตัวเดียวกับ codegrader / gradtrack ที่รันอยู่)

```powershell
cd C:\apps\scorebright
pm2 start node_modules/next/dist/bin/next --name scorebright -- start -p 3001
pm2 save            # จำ process ไว้ให้ start เองหลังรีบูต (ต้องตั้ง pm2 startup ไว้แล้ว)
pm2 logs scorebright   # ดู log ว่ารันขึ้น
```

- `--` ส่ง `start -p 3001` ให้ next → รัน production ที่ port 3001
- `next start` โหลด `.env` จากโฟลเดอร์โปรเจกต์เอง — ไม่ต้องตั้ง env ใน pm2
- ตรวจ: เปิด `http://localhost:3001/scorebright` บน server

> ให้ start เองหลัง server รีบูต: ถ้ายังไม่เคยตั้ง ให้รัน `pm2 startup` ครั้งเดียว (ติดตั้งตัวช่วยบน Windows เช่น pm2-installer) แล้ว `pm2 save`

---

## 5. ตั้ง Apache (XAMPP) reverse proxy → port 3001

แก้ `C:\xampp\apache\conf\httpd.conf` — เปิด 3 module นี้ (เอา `#` หน้าออก):

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule headers_module modules/mod_headers.so
```

เพิ่มท้าย `httpd.conf` (หรือใน VirtualHost ของ 192.168.200.9):

```apache
# ScoreBright — ส่ง /scorebright ไปที่แอป Next.js บน port 3001
ProxyPreserveHost On
ProxyPass        /scorebright  http://127.0.0.1:3001/scorebright
ProxyPassReverse /scorebright  http://127.0.0.1:3001/scorebright
```

> เว็บอื่นที่รันบน Apache อยู่แล้วไม่กระทบ เพราะ proxy เฉพาะ path `/scorebright`

แล้ว restart Apache จาก XAMPP Control Panel → เข้า **http://192.168.200.9/scorebright** ได้เลย

---

## 6. ตรวจหลัง deploy

- [ ] เปิด http://192.168.200.9/scorebright เจอหน้า login
- [ ] login admin/admin1234 ได้ (cookie ทำงานบน HTTP)
- [ ] เปลี่ยนรหัส admin + สร้างบัญชีครูจริงที่หน้า "ผู้ใช้"
- [ ] หน้ารายชื่อนักเรียนดึงข้อมูลจาก school_app ได้
- [ ] ลองสร้างวิชา กรอกคะแนน และ export ไฟล์ → import เข้า SchoolBright จริง

## อัปเดตเวอร์ชันภายหลัง

```powershell
cd C:\apps\scorebright
git pull                      # หรือ copy ไฟล์ใหม่ทับ
npm ci
npx prisma db push            # ถ้ามีการแก้ schema
npm run build
C:\nssm\nssm.exe restart ScoreBright
```
