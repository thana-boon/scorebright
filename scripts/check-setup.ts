/**
 * ตรวจความพร้อมของระบบหลังตั้งค่า .env / db push / seed:
 * 1. ต่อ MySQL ด้วย DATABASE_URL ได้
 * 2. อ่าน school_app ได้ (users / academic_years / students)
 * 3. ตาราง score_app ถูกสร้างแล้ว
 * 4. รหัสผ่าน admin/admin1234 ใช้ login ได้จริง (เทียบ bcrypt เหมือนหน้า login)
 *
 * ใช้: npx tsx scripts/check-setup.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {}

const prisma = new PrismaClient();

async function main() {
  let failures = 0;
  const ok = (label: string, pass: boolean, extra = "") => {
    console.log(`  ${pass ? "ok  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
    if (!pass) failures++;
  };

  const years = await prisma.$queryRaw<{ n: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) AS n FROM school_app.academic_years`,
  );
  ok("อ่าน school_app.academic_years", Number(years[0].n) > 0, `${years[0].n} ปี`);

  const students = await prisma.$queryRaw<{ n: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) AS n FROM school_app.students`,
  );
  ok("อ่าน school_app.students", Number(students[0].n) > 0, `${students[0].n} คน`);

  const settings = await prisma.appSetting.findMany();
  ok("ตาราง score_app (app_settings)", true, `${settings.length} แถว`);

  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    ok("บัญชี admin (score_app.users)", false, "ไม่พบ — รัน npm run seed:admin");
  } else {
    const hash = admin.passwordHash.replace(/^\$2y\$/, "$2a$");
    const match = await bcrypt.compare("admin1234", hash);
    ok("admin/admin1234 login ได้", match && admin.isActive);
  }

  console.log(failures === 0 ? "\nพร้อมใช้งาน ✔" : `\nไม่ผ่าน ${failures} ข้อ ✘`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("เชื่อมต่อไม่ได้:", err instanceof Error ? err.message.trim() : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
